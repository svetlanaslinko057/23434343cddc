"""
Assignment Engine 2.0 - Core Logic
Production Workforce Operating System

Scoring algorithm for developer-task matching:
- Skill fit (capability matrix)
- Availability fit (capacity vs load)
- Performance fit (delivery speed, quality)
- Context fit (minimize context switching)
- Growth bonus (tier system)
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


# ============ CONSTANTS ============

# Task complexity weights
COMPLEXITY_WEIGHTS = {
    "simple_bugfix": 15,
    "medium_feature": 35,
    "large_integration": 60,
    "critical_infrastructure": 80
}

# Skill matching weights
SKILL_MATCH_WEIGHTS = {
    "exact_match": 1.0,      # React in stack + React required
    "related_match": 0.7,    # Next.js in stack + React required
    "partial_match": 0.4,    # JavaScript in stack + React required
    "no_match": 0.0
}

# Load thresholds
LOAD_THRESHOLD_OVERLOAD = 0.8
LOAD_THRESHOLD_OPTIMAL_MAX = 0.8
LOAD_THRESHOLD_OPTIMAL_MIN = 0.5
LOAD_THRESHOLD_UNDERUTILIZED = 0.5

# Assignment scoring weights
ASSIGNMENT_WEIGHTS = {
    "skill_fit": 0.30,
    "availability_fit": 0.20,
    "performance_fit": 0.20,
    "quality_fit": 0.15,
    "context_fit": 0.10,
    "growth_bonus": 0.05
}

# Tier multipliers for growth bonus
TIER_MULTIPLIERS = {
    "connector": 1.0,
    "builder": 1.2,
    "architect": 1.5,
    "master": 2.0
}


# ============ CAPACITY LAYER ============

def calculate_developer_load(developer: dict, active_tasks: List[dict]) -> dict:
    """
    Calculate developer's current load
    
    Returns:
        {
            "current_load_hours": float,
            "cognitive_load": float,
            "load_index": float,  # 0.0 - 1.0+
            "status": "available" | "optimal" | "overloaded"
        }
    """
    capacity_hours = developer.get("capacity_hours_per_day", 6)
    cognitive_capacity = developer.get("cognitive_capacity", 100)
    max_parallel_tasks = developer.get("max_parallel_tasks", 2)
    
    # Calculate hours-based load
    total_hours = sum(task.get("estimated_hours", 0) - task.get("actual_hours", 0) 
                      for task in active_tasks)
    
    # Calculate cognitive load
    total_cognitive = sum(task.get("cognitive_weight", 30) for task in active_tasks)
    
    # Context switch penalty (more tasks = higher penalty)
    context_switch_penalty = 0
    if len(active_tasks) > max_parallel_tasks:
        context_switch_penalty = (len(active_tasks) - max_parallel_tasks) * 0.15
    
    # Load index calculation
    hours_ratio = total_hours / (capacity_hours * 5) if capacity_hours > 0 else 0  # 5 working days
    cognitive_ratio = total_cognitive / cognitive_capacity if cognitive_capacity > 0 else 0
    
    load_index = hours_ratio + cognitive_ratio + context_switch_penalty
    
    # Determine status
    if load_index >= LOAD_THRESHOLD_OVERLOAD:
        status = "overloaded"
    elif LOAD_THRESHOLD_OPTIMAL_MIN <= load_index < LOAD_THRESHOLD_OPTIMAL_MAX:
        status = "optimal"
    else:
        status = "available"
    
    return {
        "current_load_hours": total_hours,
        "cognitive_load": total_cognitive,
        "load_index": min(load_index, 2.0),  # Cap at 200%
        "active_tasks_count": len(active_tasks),
        "status": status,
        "capacity_hours_per_week": capacity_hours * 5,
        "context_switch_penalty": context_switch_penalty
    }


def calculate_task_priority_score(task: dict) -> float:
    """
    Calculate task operational priority
    
    priority_score = 
        urgency * 0.35 +
        business_value * 0.30 +
        dependency_criticality * 0.20 +
        complexity_risk * 0.15
    """
    urgency = task.get("urgency", 5) / 10.0  # Normalize to 0-1
    business_value = task.get("business_value", 5) / 10.0
    dependency_criticality = task.get("dependency_criticality", 5) / 10.0
    complexity = task.get("complexity", 5) / 10.0
    
    priority_score = (
        urgency * 0.35 +
        business_value * 0.30 +
        dependency_criticality * 0.20 +
        complexity * 0.15
    )
    
    return priority_score


# ============ CAPABILITY LAYER ============

def calculate_skill_fit(developer: dict, task: dict) -> float:
    """
    Calculate how well developer's capabilities match task requirements
    
    Uses capability matrix and required stack
    Returns score 0.0 - 1.0
    """
    required_stack = task.get("required_stack", [])
    required_role = task.get("required_role", "")
    
    if not required_stack:
        return 0.5  # Neutral if no requirements specified
    
    # Check role match
    role_match = 1.0 if developer.get("role") == required_role else 0.7
    
    # Get developer capabilities
    capabilities = developer.get("capabilities", {})
    dev_stack = developer.get("stack", [])
    
    # Calculate stack match score
    stack_scores = []
    for required_skill in required_stack:
        required_lower = required_skill.lower()
        
        # Check capability matrix first
        if required_lower in capabilities:
            # Capability score 1-10 normalized to 0-1
            stack_scores.append(capabilities[required_lower] / 10.0)
        # Check if in stack list
        elif required_skill in dev_stack:
            stack_scores.append(0.8)  # Good match but no capability score
        # Check related skills
        elif any(related in required_lower for related in ["react", "next", "vue"]):
            # Check if has related frontend skill
            if any(skill.lower() in ["react", "next.js", "vue", "angular"] for skill in dev_stack):
                stack_scores.append(0.6)
            else:
                stack_scores.append(0.0)
        else:
            stack_scores.append(0.0)
    
    avg_stack_score = sum(stack_scores) / len(stack_scores) if stack_scores else 0.0
    
    # Combine role and stack match
    skill_fit = (role_match * 0.3) + (avg_stack_score * 0.7)
    
    return min(skill_fit, 1.0)


def calculate_availability_fit(developer: dict, task: dict, dev_load: dict) -> float:
    """
    Calculate developer's availability for this task
    
    Returns score 0.0 - 1.0 (higher = more available)
    """
    load_index = dev_load.get("load_index", 0)
    
    # Inverse relationship: lower load = higher availability
    if load_index >= 1.0:
        return 0.0  # Overloaded
    elif load_index >= LOAD_THRESHOLD_OVERLOAD:
        return 0.2  # Almost overloaded
    elif load_index >= LOAD_THRESHOLD_OPTIMAL_MIN:
        return 0.8  # Optimal zone
    else:
        return 1.0  # Available
    

def calculate_performance_fit(developer: dict) -> float:
    """
    Calculate developer's performance score
    
    Based on historical delivery metrics
    Returns score 0.0 - 1.0
    """
    performance = developer.get("performance", {})
    
    # Get metrics (default to neutral values)
    avg_completion_time = performance.get("avg_completion_time", 8)  # hours
    tasks_completed = performance.get("tasks_completed", 0)
    
    # Delivery speed score (faster = better, but normalize)
    # Assume 8 hours is neutral, <4 is excellent, >16 is slow
    speed_score = 1.0 - min((avg_completion_time - 4) / 12, 1.0) if avg_completion_time >= 4 else 1.0
    speed_score = max(speed_score, 0.0)
    
    # Experience score (more tasks = higher reliability)
    experience_score = min(tasks_completed / 100, 1.0)  # Cap at 100 tasks
    
    # Combined performance
    performance_score = (speed_score * 0.6) + (experience_score * 0.4)
    
    return performance_score


def calculate_quality_fit(developer: dict) -> float:
    """
    Calculate developer's quality score
    
    Based on QA pass rate and revision frequency
    Returns score 0.0 - 1.0
    """
    performance = developer.get("performance", {})
    
    qa_pass_rate = performance.get("qa_pass_rate", 0.85)  # Default to good
    revision_rate = performance.get("revision_rate", 0.15)  # Default to acceptable
    
    # QA pass rate is direct quality indicator
    quality_from_qa = qa_pass_rate
    
    # Low revision rate is good (inverse relationship)
    quality_from_revisions = 1.0 - min(revision_rate, 1.0)
    
    # Combined quality score
    quality_score = (quality_from_qa * 0.7) + (quality_from_revisions * 0.3)
    
    return quality_score


def calculate_context_fit(developer: dict, task: dict, active_tasks: List[dict]) -> float:
    """
    Calculate context switching penalty
    
    Lower penalty if task is similar to current work
    Returns score 0.0 - 1.0 (higher = better fit, less switching)
    """
    if not active_tasks:
        return 1.0  # No context switch if no active tasks
    
    task_type = task.get("type", "")
    task_stack = set(task.get("required_stack", []))
    
    # Check how many active tasks are similar
    similar_tasks = 0
    for active_task in active_tasks:
        if active_task.get("type") == task_type:
            similar_tasks += 1
        
        active_stack = set(active_task.get("required_stack", []))
        if task_stack & active_stack:  # Intersection
            similar_tasks += 0.5
    
    # More similar tasks = less context switch penalty
    if similar_tasks >= 2:
        return 1.0  # Already in this context
    elif similar_tasks >= 1:
        return 0.7  # Partially in context
    else:
        return 0.3  # Full context switch needed


def calculate_growth_bonus(developer: dict) -> float:
    """
    Calculate growth/tier bonus
    
    Incentivize high-tier developers
    Returns score 0.0 - 1.0
    """
    growth = developer.get("growth", {})
    tier = growth.get("tier", "connector")
    
    multiplier = TIER_MULTIPLIERS.get(tier, 1.0)
    
    # Normalize to 0-1 scale
    bonus = (multiplier - 1.0) / 1.0  # Max multiplier is 2.0
    
    return min(bonus, 1.0)


# ============ ASSIGNMENT ENGINE ============

def calculate_assignment_score(
    developer: dict,
    task: dict,
    dev_load: dict,
    active_tasks: List[dict]
) -> Tuple[float, Dict[str, float]]:
    """
    Calculate overall assignment match score
    
    Returns:
        (total_score, breakdown_dict)
    """
    # Calculate individual components
    skill_fit = calculate_skill_fit(developer, task)
    availability_fit = calculate_availability_fit(developer, task, dev_load)
    performance_fit = calculate_performance_fit(developer)
    quality_fit = calculate_quality_fit(developer)
    context_fit = calculate_context_fit(developer, task, active_tasks)
    growth_bonus = calculate_growth_bonus(developer)
    
    # Weighted combination
    total_score = (
        skill_fit * ASSIGNMENT_WEIGHTS["skill_fit"] +
        availability_fit * ASSIGNMENT_WEIGHTS["availability_fit"] +
        performance_fit * ASSIGNMENT_WEIGHTS["performance_fit"] +
        quality_fit * ASSIGNMENT_WEIGHTS["quality_fit"] +
        context_fit * ASSIGNMENT_WEIGHTS["context_fit"] +
        growth_bonus * ASSIGNMENT_WEIGHTS["growth_bonus"]
    )
    
    breakdown = {
        "skill_fit": skill_fit,
        "availability_fit": availability_fit,
        "performance_fit": performance_fit,
        "quality_fit": quality_fit,
        "context_fit": context_fit,
        "growth_bonus": growth_bonus,
        "total_score": total_score
    }
    
    return total_score, breakdown


async def suggest_best_developers(
    task: dict,
    all_developers: List[dict],
    developer_tasks_map: Dict[str, List[dict]],
    top_n: int = 5
) -> List[Dict[str, Any]]:
    """
    Suggest best developers for a task
    
    Returns list of suggestions sorted by match score
    """
    suggestions = []
    
    for developer in all_developers:
        dev_id = developer.get("user_id")
        
        # Skip if developer is not active
        if developer.get("status") != "active":
            continue
        
        # Get developer's active tasks
        active_tasks = developer_tasks_map.get(dev_id, [])
        
        # Calculate load
        dev_load = calculate_developer_load(developer, active_tasks)
        
        # Skip if overloaded (unless critical task)
        if dev_load["status"] == "overloaded" and task.get("priority") != "critical":
            continue
        
        # Calculate assignment score
        match_score, breakdown = calculate_assignment_score(
            developer, task, dev_load, active_tasks
        )
        
        suggestions.append({
            "developer_id": dev_id,
            "developer_name": developer.get("name"),
            "developer_role": developer.get("role"),
            "match_score": match_score,
            "load_status": dev_load["status"],
            "load_index": dev_load["load_index"],
            "active_tasks_count": dev_load["active_tasks_count"],
            "score_breakdown": breakdown,
            "reason": generate_assignment_reason(breakdown, dev_load)
        })
    
    # Sort by match score (descending)
    suggestions.sort(key=lambda x: x["match_score"], reverse=True)
    
    return suggestions[:top_n]


def generate_assignment_reason(breakdown: dict, dev_load: dict) -> str:
    """Generate human-readable reason for assignment suggestion"""
    reasons = []
    
    if breakdown["skill_fit"] > 0.8:
        reasons.append("excellent skill match")
    elif breakdown["skill_fit"] > 0.6:
        reasons.append("good skill match")
    
    if dev_load["status"] == "available":
        reasons.append("available capacity")
    elif dev_load["status"] == "optimal":
        reasons.append("optimal load")
    
    if breakdown["quality_fit"] > 0.9:
        reasons.append("high quality record")
    
    if breakdown["performance_fit"] > 0.8:
        reasons.append("fast delivery")
    
    if breakdown["context_fit"] > 0.7:
        reasons.append("minimal context switch")
    
    return ", ".join(reasons) if reasons else "capable developer"


# ============ TEAM ANALYTICS ============

def analyze_team_capacity(
    developers: List[dict],
    developer_tasks_map: Dict[str, List[dict]]
) -> Dict[str, Any]:
    """
    Analyze overall team capacity and bottlenecks
    
    Returns:
        {
            "total_capacity": float,
            "total_load": float,
            "utilization": float,
            "available_count": int,
            "optimal_count": int,
            "overloaded_count": int,
            "by_role": {...},
            "bottlenecks": [...]
        }
    """
    total_capacity = 0
    total_load = 0
    
    status_counts = {"available": 0, "optimal": 0, "overloaded": 0}
    role_breakdown = {}
    bottlenecks = []
    
    for developer in developers:
        if developer.get("status") != "active":
            continue
        
        dev_id = developer.get("user_id")
        role = developer.get("role", "unknown")
        
        # Get tasks and calculate load
        active_tasks = developer_tasks_map.get(dev_id, [])
        dev_load = calculate_developer_load(developer, active_tasks)
        
        # Update totals
        capacity_hours = developer.get("capacity_hours_per_day", 6) * 5  # Per week
        total_capacity += capacity_hours
        total_load += dev_load["current_load_hours"]
        
        # Update status counts
        status_counts[dev_load["status"]] += 1
        
        # Role breakdown
        if role not in role_breakdown:
            role_breakdown[role] = {
                "count": 0,
                "capacity": 0,
                "load": 0,
                "available": 0,
                "optimal": 0,
                "overloaded": 0
            }
        
        role_breakdown[role]["count"] += 1
        role_breakdown[role]["capacity"] += capacity_hours
        role_breakdown[role]["load"] += dev_load["current_load_hours"]
        role_breakdown[role][dev_load["status"]] += 1
        
        # Identify bottlenecks
        if dev_load["status"] == "overloaded":
            bottlenecks.append({
                "developer_id": dev_id,
                "developer_name": developer.get("name"),
                "role": role,
                "load_index": dev_load["load_index"],
                "active_tasks": dev_load["active_tasks_count"],
                "issue": "overloaded"
            })
    
    # Calculate utilization
    utilization = (total_load / total_capacity) if total_capacity > 0 else 0
    
    # Calculate role utilization
    for role_data in role_breakdown.values():
        role_data["utilization"] = (
            role_data["load"] / role_data["capacity"] 
            if role_data["capacity"] > 0 else 0
        )
    
    return {
        "total_capacity": total_capacity,
        "total_load": total_load,
        "utilization": utilization,
        "available_count": status_counts["available"],
        "optimal_count": status_counts["optimal"],
        "overloaded_count": status_counts["overloaded"],
        "by_role": role_breakdown,
        "bottlenecks": bottlenecks
    }


def identify_rebalance_opportunities(
    developers: List[dict],
    developer_tasks_map: Dict[str, List[dict]]
) -> List[Dict[str, Any]]:
    """
    Identify opportunities to rebalance workload
    
    Returns list of suggested task reassignments
    """
    opportunities = []
    
    overloaded_devs = []
    available_devs = []
    
    for developer in developers:
        if developer.get("status") != "active":
            continue
        
        dev_id = developer.get("user_id")
        active_tasks = developer_tasks_map.get(dev_id, [])
        dev_load = calculate_developer_load(developer, active_tasks)
        
        if dev_load["status"] == "overloaded":
            overloaded_devs.append((developer, active_tasks, dev_load))
        elif dev_load["status"] == "available":
            available_devs.append((developer, active_tasks, dev_load))
    
    # For each overloaded developer, find tasks to reassign
    for overloaded_dev, tasks, load in overloaded_devs:
        # Sort tasks by priority (reassign lowest priority first)
        sorted_tasks = sorted(
            tasks,
            key=lambda t: calculate_task_priority_score(t)
        )
        
        for task in sorted_tasks[:3]:  # Consider top 3 tasks to reassign
            # Find best available developer
            for available_dev, _, _ in available_devs:
                if available_dev.get("role") == task.get("required_role"):
                    opportunities.append({
                        "task_id": task.get("unit_id"),
                        "task_title": task.get("title"),
                        "from_developer": overloaded_dev.get("name"),
                        "to_developer": available_dev.get("name"),
                        "from_load": load["load_index"],
                        "reason": "rebalance workload"
                    })
                    break
    
    return opportunities
