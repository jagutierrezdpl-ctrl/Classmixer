"""
ClassMixer OR-Tools Solver
FastAPI microservice that uses CP-SAT to generate optimal class assignments.
Deploy to Railway / Render / Fly.io and set PYTHON_SERVICE_URL in Vercel.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from ortools.sat.python import cp_model
import random
import math

app = FastAPI(title="ClassMixer Solver", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Input models ──────────────────────────────────────────────────────────────

class StudentInput(BaseModel):
    id: str
    gender: Optional[str] = None
    average_grade: float = 0.0
    academic_level: Optional[str] = None
    behavior_level: Optional[str] = None
    needs_type: Optional[str] = None
    current_class: Optional[str] = None

class ResponseInput(BaseModel):
    respondent_student_id: str
    target_student_id: str
    relation_type: str  # catalog-driven code; legacy defaults: friendship | work | emotional | negative
    weight: float = 1.0

class RuleInput(BaseModel):
    id: str
    rule_type: str
    priority: str = "alta"
    active: bool = True
    student_ids: list[str] = []
    target_class: Optional[str] = None
    max_count: Optional[int] = None

class Weights(BaseModel):
    conflicts: float = 100.0
    avoid_isolation: float = 95.0
    reciprocal_friendships: float = 90.0
    chosen_friendships: float = 85.0
    academic_balance: float = 80.0
    needs_distribution: float = 80.0
    work_relations: float = 75.0
    behavior: float = 70.0
    gender_balance: float = 60.0
    group_mix: float = 50.0

class ConstraintsInput(BaseModel):
    enforce_origin_mix: bool = True
    max_origin_pct: int = 50       # 0-100: max % of one origin class per target class
    enforce_gender_balance: bool = False
    gender_tolerance: int = 15     # 0-50: max % deviation from global gender ratio
    enforce_equal_size: bool = False  # all target classes within 1 student of each other

class SolveRequest(BaseModel):
    students: list[StudentInput]
    responses: list[ResponseInput]
    rules: list[RuleInput]
    target_classes: list[str]
    min_per_class: int = 20
    max_per_class: int = 30
    weights: Weights = Weights()
    constraints: ConstraintsInput = ConstraintsInput()
    num_proposals: int = 3
    time_limit_seconds: int = 30
    seed: int = 42
    # Which response.relation_type codes count as each scoring role. Defaults
    # reproduce the original hardcoded "friendship"/"work"/"negative" behavior;
    # callers with a question catalog can pass wider lists (e.g. role_nomination
    # codes alongside "friendship").
    friendship_types: list[str] = ["friendship"]
    work_types: list[str] = ["work"]
    negative_types: list[str] = ["negative"]

class Assignment(BaseModel):
    student_id: str
    target_class: str

class ClassMetrics(BaseModel):
    count: int
    average_grade: float
    female: int
    male: int
    students_with_friend: int
    reciprocal_preserved: int
    with_needs: int
    with_behavior_issues: int

class ProposalResult(BaseModel):
    assignments: list[Assignment]
    score_total: float
    score_social: float
    score_academic: float
    score_gender: float
    score_behavior: float
    metrics: dict[str, ClassMetrics]
    infeasible_rules: list[str] = []

class SolveResponse(BaseModel):
    proposals: list[ProposalResult]
    feasible: bool
    infeasibility_explanation: list[str] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def build_relation_set(responses: list[ResponseInput], relation_types: list[str]) -> set[tuple[str, str]]:
    types = set(relation_types)
    return {(r.respondent_student_id, r.target_student_id) for r in responses if r.relation_type in types}

def build_friendship_set(responses: list[ResponseInput], friendship_types: list[str] = ["friendship"]) -> set[tuple[str, str]]:
    return build_relation_set(responses, friendship_types)

def build_reciprocal_set(responses: list[ResponseInput], friendship_types: list[str] = ["friendship"]) -> set[tuple[str, str]]:
    friendships = build_friendship_set(responses, friendship_types)
    return {(a, b) for (a, b) in friendships if (b, a) in friendships and a < b}

def priority_multiplier(priority: str) -> float:
    return {"obligatoria": 2.0, "alta": 1.5, "media": 1.0, "baja": 0.5}.get(priority, 1.0)

def build_conflict_pairs(responses: list[ResponseInput], rules: list[RuleInput]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for rule in rules:
        if rule.rule_type == "must_separate" and rule.active and len(rule.student_ids) >= 2:
            ids = rule.student_ids
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    pairs.append((ids[i], ids[j]))
    return pairs

def compute_metrics(
    assignments: list[Assignment],
    students: list[StudentInput],
    responses: list[ResponseInput],
    target_classes: list[str],
    friendship_types: list[str] = ["friendship"],
) -> dict[str, ClassMetrics]:
    student_map = {s.id: s for s in students}
    assign_map = {a.student_id: a.target_class for a in assignments}
    friendships = build_friendship_set(responses, friendship_types)
    reciprocals = build_reciprocal_set(responses, friendship_types)

    metrics: dict[str, ClassMetrics] = {}
    for cls in target_classes:
        cls_ids = {a.student_id for a in assignments if a.target_class == cls}
        cls_students = [student_map[sid] for sid in cls_ids if sid in student_map]

        grades = [s.average_grade for s in cls_students if s.average_grade > 0]
        avg_grade = sum(grades) / len(grades) if grades else 0.0

        students_with_friend = sum(
            1 for s in cls_students
            if any((s.id, t) in friendships and t in cls_ids for t in cls_ids)
        )
        reciprocal_preserved = sum(
            1 for (a, b) in reciprocals
            if a in cls_ids and b in cls_ids
        )

        metrics[cls] = ClassMetrics(
            count=len(cls_students),
            average_grade=round(avg_grade, 3),
            female=sum(1 for s in cls_students if s.gender == "F"),
            male=sum(1 for s in cls_students if s.gender == "M"),
            students_with_friend=students_with_friend,
            reciprocal_preserved=reciprocal_preserved,
            with_needs=sum(1 for s in cls_students if s.needs_type and s.needs_type not in ("No", None)),
            with_behavior_issues=sum(1 for s in cls_students if s.behavior_level in ("Seguimiento", "Conflictiva")),
        )
    return metrics

def score_proposal(
    assignments: list[Assignment],
    students: list[StudentInput],
    responses: list[ResponseInput],
    rules: list[RuleInput],
    target_classes: list[str],
    weights: Weights,
    friendship_types: list[str] = ["friendship"],
) -> tuple[float, float, float, float, float]:
    metrics = compute_metrics(assignments, students, responses, target_classes, friendship_types)
    assign_map = {a.student_id: a.target_class for a in assignments}
    friendships = build_friendship_set(responses, friendship_types)
    reciprocals = build_reciprocal_set(responses, friendship_types)
    n = len(students)
    nc = len(target_classes)

    # Social score
    total_with_friend = sum(m.students_with_friend for m in metrics.values())
    total_reciprocal = sum(m.reciprocal_preserved for m in metrics.values())
    total_possible_reciprocal = len(reciprocals)
    social = 0.0
    if n > 0:
        social += (total_with_friend / n) * 50
    if total_possible_reciprocal > 0:
        social += (total_reciprocal / total_possible_reciprocal) * 50

    # Academic balance
    grades = [m.average_grade for m in metrics.values() if m.average_grade > 0]
    if len(grades) >= 2:
        grade_range = max(grades) - min(grades)
        academic = max(0, 100 - grade_range * 30)
    else:
        academic = 100.0

    # Gender balance
    gender_scores = []
    for m in metrics.values():
        if m.count > 0:
            ratio = abs(m.female / m.count - 0.5)
            gender_scores.append(max(0, 100 - ratio * 200))
    gender = sum(gender_scores) / len(gender_scores) if gender_scores else 100.0

    # Behavior (distribution of difficult students)
    behavior_scores = []
    for m in metrics.values():
        if m.count > 0:
            pct = m.with_behavior_issues / m.count
            behavior_scores.append(max(0, 100 - pct * 200))
    behavior = sum(behavior_scores) / len(behavior_scores) if behavior_scores else 100.0

    # Penalty for violated must_separate rules
    conflict_penalty = 0.0
    conflict_pairs = build_conflict_pairs(responses, rules)
    for a, b in conflict_pairs:
        ca, cb = assign_map.get(a), assign_map.get(b)
        if ca and cb and ca == cb:
            conflict_penalty += 20.0

    total = (
        social * (weights.reciprocal_friendships / 100) +
        academic * (weights.academic_balance / 100) +
        gender * (weights.gender_balance / 100) +
        behavior * (weights.behavior / 100)
    ) / 4 * 100 - conflict_penalty

    return max(0, min(100, total)), social, academic, gender, behavior


# ── CP-SAT solver ─────────────────────────────────────────────────────────────

def solve_with_ortools(
    req: SolveRequest,
    seed: int,
) -> tuple[Optional[list[Assignment]], list[str]]:
    students = req.students
    target_classes = req.target_classes
    rules = [r for r in req.rules if r.active]
    n = len(students)
    nc = len(target_classes)

    if n == 0 or nc == 0:
        return None, ["No hay alumnos o clases destino"]

    rng = random.Random(seed)
    student_ids = [s.id for s in students]
    class_idx = {c: i for i, c in enumerate(target_classes)}
    student_idx = {sid: i for i, sid in enumerate(student_ids)}

    model = cp_model.CpModel()

    # x[s][c] = 1 if student s is in class c
    x = [[model.new_bool_var(f"x_{s}_{c}") for c in range(nc)] for s in range(n)]

    # Each student in exactly one class
    for s in range(n):
        model.add_exactly_one(x[s])

    # Class size constraints
    constraints = req.constraints
    if constraints.enforce_equal_size:
        min_size = n // nc
        max_size = math.ceil(n / nc)
        for c in range(nc):
            model.add(sum(x[s][c] for s in range(n)) >= min_size)
            model.add(sum(x[s][c] for s in range(n)) <= max_size)
    else:
        for c in range(nc):
            model.add(sum(x[s][c] for s in range(n)) >= req.min_per_class)
            model.add(sum(x[s][c] for s in range(n)) <= req.max_per_class)

    # Origin mix constraint: no more than max_origin_pct% of a class from the same origin class
    if constraints.enforce_origin_mix:
        origins = {s.current_class for s in students if s.current_class}
        for origin in origins:
            origin_sids = [i for i, s in enumerate(students) if s.current_class == origin]
            if not origin_sids:
                continue
            for c in range(nc):
                class_size = sum(x[s][c] for s in range(n))
                origin_in_class = sum(x[s][c] for s in origin_sids)
                # 100 * origin_in_class <= max_origin_pct * class_size
                model.add(100 * origin_in_class <= constraints.max_origin_pct * class_size)

    # Gender balance constraint: each class within `gender_tolerance`% of the global F ratio
    if constraints.enforce_gender_balance:
        total_f = sum(1 for s in students if s.gender == "F")
        total_known = sum(1 for s in students if s.gender in ("F", "M"))
        if total_known > 0:
            ratio_scaled = round((total_f / total_known) * 1000)
            tolerance_scaled = round(constraints.gender_tolerance * 10)
            female_idx = [i for i, s in enumerate(students) if s.gender == "F"]
            known_idx = [i for i, s in enumerate(students) if s.gender in ("F", "M")]
            for c in range(nc):
                f_in_class = sum(x[s][c] for s in female_idx)
                known_in_class = sum(x[s][c] for s in known_idx)
                model.add(1000 * f_in_class - ratio_scaled * known_in_class + tolerance_scaled * known_in_class >= 0)
                model.add(1000 * f_in_class - ratio_scaled * known_in_class - tolerance_scaled * known_in_class <= 0)

    infeasible_rules: list[str] = []

    # Hard rules
    for rule in rules:
        sids = rule.student_ids
        valid_sids = [sid for sid in sids if sid in student_idx]

        if rule.rule_type == "must_separate":
            for i in range(len(valid_sids)):
                for j in range(i + 1, len(valid_sids)):
                    si, sj = student_idx[valid_sids[i]], student_idx[valid_sids[j]]
                    for c in range(nc):
                        model.add(x[si][c] + x[sj][c] <= 1)

        elif rule.rule_type in ("must_keep_together",):
            if len(valid_sids) >= 2:
                # All must be in same class — force to first valid student's class
                s0 = student_idx[valid_sids[0]]
                for sid in valid_sids[1:]:
                    si = student_idx[sid]
                    for c in range(nc):
                        model.add(x[s0][c] == x[si][c])

        elif rule.rule_type in ("lock_student_to_class", "with_tutor") and rule.target_class and valid_sids:
            c_idx = class_idx.get(rule.target_class)
            if c_idx is not None:
                for sid in valid_sids:
                    s_i = student_idx[sid]
                    model.add(x[s_i][c_idx] == 1)

        elif rule.rule_type == "exclude_student" and valid_sids:
            for sid in valid_sids:
                pass  # Excluded students shouldn't be in the input at all

        elif rule.rule_type == "max_from_group" and rule.max_count and valid_sids:
            for c in range(nc):
                model.add(sum(x[student_idx[sid]][c] for sid in valid_sids if sid in student_idx) <= rule.max_count)

    # Objective: maximize soft constraints
    friendships = build_friendship_set(req.responses, req.friendship_types)
    reciprocals = build_reciprocal_set(req.responses, req.friendship_types)
    student_map = {s.id: s for s in students}

    obj_terms = []

    def class_match_tokens(si: int, sj: int, tag: str) -> list:
        tokens = []
        for c in range(nc):
            tok = model.new_bool_var(f"{tag}_{si}_{sj}_{c}")
            model.add(x[si][c] + x[sj][c] - 1 <= tok)
            model.add(tok <= x[si][c])
            model.add(tok <= x[sj][c])
            tokens.append(tok)
        return tokens

    # should_keep_together / keep_at_least_one / protect_vulnerable:
    # soft by default, escalated to hard constraints when rule.priority == "obligatoria"
    for rule in rules:
        valid_sids = [sid for sid in rule.student_ids if sid in student_idx]
        mult = priority_multiplier(rule.priority)

        if rule.rule_type == "should_keep_together" and len(valid_sids) >= 2:
            s0 = student_idx[valid_sids[0]]
            w = int(req.weights.chosen_friendships * mult)
            for sid in valid_sids[1:]:
                si = student_idx[sid]
                tokens = class_match_tokens(s0, si, "should")
                obj_terms.append(sum(tokens) * w)
                if rule.priority == "obligatoria":
                    for c in range(nc):
                        model.add(x[s0][c] == x[si][c])

        elif rule.rule_type in ("keep_at_least_one", "protect_vulnerable") and len(valid_sids) >= 2:
            main_i = student_idx[valid_sids[0]]
            friend_idxs = [student_idx[sid] for sid in valid_sids[1:]]
            all_tokens = []
            for fi in friend_idxs:
                all_tokens.extend(class_match_tokens(main_i, fi, rule.rule_type))
            satisfied = model.new_bool_var(f"{rule.rule_type}_{rule.id}")
            model.add(satisfied <= sum(all_tokens))
            w = int(req.weights.avoid_isolation * mult)
            obj_terms.append(satisfied * w)
            if rule.priority == "obligatoria":
                model.add(sum(all_tokens) >= 1)

    # Reward reciprocal friendships in same class
    w_recip = int(req.weights.reciprocal_friendships)
    for a, b in reciprocals:
        if a in student_idx and b in student_idx:
            sa, sb = student_idx[a], student_idx[b]
            for c in range(nc):
                same = model.new_bool_var(f"recip_{a}_{b}_{c}")
                model.add(x[sa][c] + x[sb][c] - 1 <= same)
                model.add(same <= x[sa][c])
                model.add(same <= x[sb][c])
                obj_terms.append(same * w_recip)

    # Reward friendships in same class (non-reciprocal)
    w_friend = int(req.weights.chosen_friendships // 2)
    for a, b in friendships:
        if (min(a, b), max(a, b)) not in reciprocals and a in student_idx and b in student_idx:
            sa, sb = student_idx[a], student_idx[b]
            for c in range(nc):
                same = model.new_bool_var(f"friend_{a}_{b}_{c}")
                model.add(x[sa][c] + x[sb][c] - 1 <= same)
                model.add(same <= x[sa][c])
                model.add(same <= x[sb][c])
                obj_terms.append(same * w_friend)

    # Reward work relations placed in the same class
    work_pairs = build_relation_set(req.responses, req.work_types)
    w_work = int(req.weights.work_relations // 2)
    for a, b in work_pairs:
        if a in student_idx and b in student_idx:
            sa, sb = student_idx[a], student_idx[b]
            for c in range(nc):
                same = model.new_bool_var(f"work_{a}_{b}_{c}")
                model.add(x[sa][c] + x[sb][c] - 1 <= same)
                model.add(same <= x[sa][c])
                model.add(same <= x[sb][c])
                obj_terms.append(same * w_work)

    # Penalize placing students with mutual friction ("negative" responses) together.
    # must_separate rules above stay hard; this softly extends the same idea to
    # self-reported friction that isn't backed by an explicit admin rule.
    negative_pairs = build_relation_set(req.responses, req.negative_types)
    w_conflict = int(req.weights.conflicts // 2)
    for a, b in negative_pairs:
        if a in student_idx and b in student_idx:
            sa, sb = student_idx[a], student_idx[b]
            for c in range(nc):
                same = model.new_bool_var(f"negative_{a}_{b}_{c}")
                model.add(x[sa][c] + x[sb][c] - 1 <= same)
                model.add(same <= x[sa][c])
                model.add(same <= x[sb][c])
                obj_terms.append(-same * w_conflict)

    # Grade balance: minimize max-min average grade across classes (approximated)
    # We'll use a linear approximation by penalizing grade concentration
    # Group students by grade quartile
    sorted_by_grade = sorted(range(n), key=lambda i: students[i].average_grade, reverse=True)
    quartile_size = max(1, n // (nc * 2))
    for q_start in range(0, min(n, nc * 2 * quartile_size), quartile_size):
        q_end = min(q_start + quartile_size, n)
        q_students = sorted_by_grade[q_start:q_end]
        w_academic = int(req.weights.academic_balance // 4)
        for c in range(nc):
            count_in_class = sum(x[q_students[i]][c] for i in range(len(q_students)))
            # Penalize if too many of same quartile in one class
            ideal = len(q_students) // nc
            deviation = model.new_int_var(0, len(q_students), f"q_dev_{q_start}_{c}")
            model.add_abs_equality(deviation, count_in_class - ideal)
            obj_terms.append(-deviation * w_academic)

    def add_distribution_balance(flags: list[int], weight: int, tag: str) -> None:
        """Soft-penalize uneven distribution of flagged students across classes."""
        total = sum(flags)
        if total == 0 or weight <= 0:
            return
        ideal = total // nc
        flagged_idx = [i for i, f in enumerate(flags) if f]
        for c in range(nc):
            count_in_class = sum(x[i][c] for i in flagged_idx)
            deviation = model.new_int_var(0, total, f"{tag}_dev_{c}")
            model.add_abs_equality(deviation, count_in_class - ideal)
            obj_terms.append(-deviation * weight)

    # Needs distribution: spread students with special needs across classes
    needs_flags = [1 if s.needs_type and s.needs_type not in ("No", None) else 0 for s in students]
    add_distribution_balance(needs_flags, int(req.weights.needs_distribution // 4), "needs")

    # Behavior: spread students with behavior issues across classes
    behavior_flags = [1 if s.behavior_level in ("Seguimiento", "Conflictiva") else 0 for s in students]
    add_distribution_balance(behavior_flags, int(req.weights.behavior // 4), "behavior")

    # Gender balance: soft nudge toward an even split, independent of the hard
    # `enforce_gender_balance` toggle (which only kicks in when explicitly enabled)
    female_flags = [1 if s.gender == "F" else 0 for s in students]
    add_distribution_balance(female_flags, int(req.weights.gender_balance // 4), "gender")

    # Group mix: soft nudge to spread each origin class across all target classes,
    # independent of the hard `enforce_origin_mix` toggle
    w_group_mix = int(req.weights.group_mix // 4)
    if w_group_mix > 0:
        origins = {s.current_class for s in students if s.current_class}
        for origin in origins:
            origin_flags = [1 if s.current_class == origin else 0 for s in students]
            add_distribution_balance(origin_flags, w_group_mix, f"origin_{origin}")

    if obj_terms:
        model.maximize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = req.time_limit_seconds
    solver.parameters.random_seed = seed
    solver.parameters.num_search_workers = 4

    status = solver.solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for s, sid in enumerate(student_ids):
            for c, cls in enumerate(target_classes):
                if solver.value(x[s][c]):
                    assignments.append(Assignment(student_id=sid, target_class=cls))
                    break
        return assignments, []
    elif status == cp_model.INFEASIBLE:
        return None, ["El problema es infactible. Revisa las reglas obligatorias (separaciones, bloqueos de clase) o amplía el rango de tamaño de clase."]
    else:
        # Timeout — return heuristic fallback
        return None, ["Tiempo límite alcanzado sin solución óptima. Prueba a reducir el número de reglas o aumentar el tiempo límite."]


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "classmixer-solver"}


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest):
    if not req.students:
        raise HTTPException(status_code=400, detail="No students provided")
    if not req.target_classes:
        raise HTTPException(status_code=400, detail="No target classes provided")

    proposals: list[ProposalResult] = []
    seen_assignments: list[set] = []

    for proposal_idx in range(req.num_proposals):
        seed = req.seed + proposal_idx * 137

        assignments, errors = solve_with_ortools(req, seed)

        if assignments is None:
            return SolveResponse(
                proposals=[],
                feasible=False,
                infeasibility_explanation=errors,
            )

        # Deduplicate: skip if too similar to existing proposals
        assign_sig = frozenset((a.student_id, a.target_class) for a in assignments)
        if any(len(assign_sig.symmetric_difference(prev)) < len(req.students) * 0.05 for prev in seen_assignments):
            # Too similar — shuffle and retry with different seed
            assignments, errors = solve_with_ortools(req, seed + 999)
            if assignments is None:
                continue
            assign_sig = frozenset((a.student_id, a.target_class) for a in assignments)

        seen_assignments.append(assign_sig)

        total, social, academic, gender, behavior = score_proposal(
            assignments, req.students, req.responses, req.rules, req.target_classes, req.weights, req.friendship_types
        )
        metrics = compute_metrics(assignments, req.students, req.responses, req.target_classes, req.friendship_types)

        proposals.append(ProposalResult(
            assignments=assignments,
            score_total=round(total, 1),
            score_social=round(social, 1),
            score_academic=round(academic, 1),
            score_gender=round(gender, 1),
            score_behavior=round(behavior, 1),
            metrics=metrics,
            infeasible_rules=[],
        ))

    # Sort by total score descending
    proposals.sort(key=lambda p: p.score_total, reverse=True)

    return SolveResponse(proposals=proposals, feasible=True)
