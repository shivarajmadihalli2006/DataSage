
"""Connect schema changes to existing data-quality findings."""

from typing import Any


RULES_BY_CHANGE = {
    "type_changed": [
        "invalid_numeric",
        "invalid_date",
        "mixed_type",
        "inconsistent_date_format",
    ],
    "value_pattern_changed": [
        "invalid_numeric",
        "invalid_date",
        "mixed_type",
        "inconsistent_date_format",
        "encoding_edge_case",
    ],
    "categorical_values_changed": [
        "inconsistent_categorical_value",
        "casing_inconsistency",
    ],
    "null_percentage_changed": [
        "empty_string",
        "required_field_missing",
    ],
}


def analyze_rule_impact(
    schema_changes: list[dict[str, Any]],
    findings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Match schema changes to actual profiler findings."""

    impacts = []

    for change in schema_changes:
        change_type = change.get("changeType", "")
        column = change.get("column")

        if not column:
            continue

        relevant_rules = RULES_BY_CHANGE.get(change_type, [])

        matching_findings = [
            finding
            for finding in findings
            if finding.get("column") == column
            and finding.get("issue_type") in relevant_rules
        ]

        impacts.append({
            "changeType": change_type,
            "column": column,
            "affectedRules": relevant_rules,
            "existingFindingCount": len(matching_findings),
            "existingFindings": matching_findings,
            "status": (
                "existing_issues_found"
                if matching_findings
                else "no_matching_findings"
            ),
        })

    return impacts
