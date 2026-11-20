
"""Compare two CSV versions for structural and potential semantic drift."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from itertools import product

import pandas as pd


def _normalise_name(name: str) -> str:
    """Normalize a column name for comparison."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _name_similarity(old_name: str, new_name: str) -> float:
    """Return a name similarity score between 0 and 1."""
    old_normal = _normalise_name(old_name)
    new_normal = _normalise_name(new_name)

    if not old_normal or not new_normal:
        return 0.0

    return SequenceMatcher(None, old_normal, new_normal).ratio()


def _infer_type(series: pd.Series) -> str:
    """Infer a practical data type from CSV values."""
    values = series.dropna().astype(str).str.strip()
    values = values[values != ""]

    if values.empty:
        return "empty"

    lower = values.str.lower()

    if lower.isin(["true", "false", "yes", "no"]).all():
        return "boolean"

    numeric = pd.to_numeric(values, errors="coerce")
    if numeric.notna().all():
        if (numeric % 1 == 0).all():
            return "integer"
        return "numeric"

    date_values = pd.to_datetime(
    values,
    errors="coerce",
    format="mixed",
)
    if date_values.notna().mean() >= 0.90:
        return "date_or_datetime"

    return "string"


def _value_pattern(series: pd.Series) -> str:
    """Identify common patterns without assuming business meaning."""
    values = series.dropna().astype(str).str.strip()
    values = values[values != ""]

    if values.empty:
        return "empty"

    checks = [
        ("email", r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
        ("url", r"^https?://"),
        ("uuid", r"^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}$"),
        ("phone_like", r"^\+?[\d\s().-]{7,}$"),
        ("date_like", r"^\d{4}[-/]\d{1,2}[-/]\d{1,4}$"),
    ]

    for label, pattern in checks:
        if values.str.match(pattern, case=False).mean() >= 0.80:
            return label

    inferred = _infer_type(values)
    if inferred in {"integer", "numeric", "boolean", "date_or_datetime"}:
        return inferred

    return "general_text"


def _column_summary(series: pd.Series) -> dict:
    non_empty = series.dropna().astype(str).str.strip()
    non_empty = non_empty[non_empty != ""]

    return {
        "inferredType": _infer_type(series),
        "nullPercentage": round(
            (1 - len(non_empty) / max(len(series), 1)) * 100, 2
        ),
        "distinctCount": int(non_empty.nunique()),
        "valuePattern": _value_pattern(series),
    }


def _value_overlap(old_series: pd.Series, new_series: pd.Series) -> float:
    """Compare sampled distinct values; this is evidence, not proof of identity."""
    old_values = set(
        old_series.dropna().astype(str).str.strip().replace("", pd.NA).dropna().unique()
    )
    new_values = set(
        new_series.dropna().astype(str).str.strip().replace("", pd.NA).dropna().unique()
    )

    if not old_values or not new_values:
        return 0.0

    return len(old_values & new_values) / len(old_values | new_values)


def _categorical_change(
    old_series: pd.Series,
    new_series: pd.Series,
) -> dict:
    """Compare category values and their distributions between versions."""

    def get_counts(series: pd.Series) -> dict[str, int]:
        values = series.dropna().astype(str).str.strip()
        values = values[values != ""]
        return values.value_counts().to_dict()

    old_counts = get_counts(old_series)
    new_counts = get_counts(new_series)

    old_categories = set(old_counts)
    new_categories = set(new_counts)

    old_total = sum(old_counts.values())
    new_total = sum(new_counts.values())

    added = sorted(new_categories - old_categories)
    removed = sorted(old_categories - new_categories)

    old_distribution = {
        key: round(count / old_total * 100, 2)
        for key, count in old_counts.items()
    } if old_total else {}

    new_distribution = {
        key: round(count / new_total * 100, 2)
        for key, count in new_counts.items()
    } if new_total else {}

    shared = old_categories & new_categories

    distribution_changes = []
    for category in sorted(shared):
        old_pct = old_distribution[category]
        new_pct = new_distribution[category]

        if abs(new_pct - old_pct) >= 10:
            distribution_changes.append({
                "category": category,
                "oldPercentage": old_pct,
                "newPercentage": new_pct,
                "changePercentagePoints": round(new_pct - old_pct, 2),
            })

    return {
        "addedCategories": added,
        "removedCategories": removed,
        "distributionChanges": distribution_changes,
        "oldCategoryCount": len(old_categories),
        "newCategoryCount": len(new_categories),
    }

def _compare_rows(old_df: pd.DataFrame, new_df: pd.DataFrame) -> dict:
    """Compare records using a shared, unique identifier column."""

    shared_columns = [
        column for column in old_df.columns
        if column in new_df.columns
    ]

    # Prefer columns such as customer_id or id.
    preferred = sorted(
        shared_columns,
        key=lambda column: (
            0 if column.lower() == "id" else
            1 if column.lower().endswith("_id") else 2,
            column.lower(),
        ),
    )

    key_column = None

    for column in preferred:
        old_keys = old_df[column].astype("string").str.strip()
        new_keys = new_df[column].astype("string").str.strip()

        if (
            old_keys.notna().all()
            and new_keys.notna().all()
            and old_keys.ne("").all()
            and new_keys.ne("").all()
            and old_keys.is_unique
            and new_keys.is_unique
        ):
            key_column = column
            break

    if key_column is None:
        return {
            "status": "unavailable",
            "keyColumn": None,
            "addedRows": [],
            "removedRows": [],
            "modifiedRows": [],
            "note": (
                "Could not find a shared column with unique, "
                "non-empty identifiers in both datasets."
            ),
        }

    old_records = old_df.copy()
    new_records = new_df.copy()

    old_records[key_column] = (
        old_records[key_column].astype("string").str.strip()
    )
    new_records[key_column] = (
        new_records[key_column].astype("string").str.strip()
    )

    old_records = old_records.set_index(key_column, drop=False)
    new_records = new_records.set_index(key_column, drop=False)

    old_ids = set(old_records.index)
    new_ids = set(new_records.index)

    added_ids = sorted(new_ids - old_ids)
    removed_ids = sorted(old_ids - new_ids)
    shared_ids = sorted(old_ids & new_ids)

    added_rows = [
        new_records.loc[row_id].to_dict()
        for row_id in added_ids
    ]
    removed_rows = [
        old_records.loc[row_id].to_dict()
        for row_id in removed_ids
    ]

    comparable_columns = [
        column for column in shared_columns
        if column != key_column
    ]

    modified_rows = []

    for row_id in shared_ids:
        old_row = old_records.loc[row_id]
        new_row = new_records.loc[row_id]
        changed_fields = {}

        for column in comparable_columns:
            old_value = old_row[column]
            new_value = new_row[column]

            old_value = (
                None if pd.isna(old_value) else str(old_value)
            )
            new_value = (
                None if pd.isna(new_value) else str(new_value)
            )

            if old_value != new_value:
                changed_fields[column] = {
                    "oldValue": old_value,
                    "newValue": new_value,
                }

        if changed_fields:
            modified_rows.append({
                "key": str(row_id),
                "changes": changed_fields,
            })

    return {
        "status": "compared",
        "keyColumn": key_column,
        "addedRows": added_rows,
        "removedRows": removed_rows,
        "modifiedRows": modified_rows,
        "note": (
            "Rows were matched by a shared unique identifier. "
            "Changes are based on exact string comparisons."
        ),
    }


def compare_dataframes(
    old_df: pd.DataFrame,
    new_df: pd.DataFrame,
) -> dict:
    """Compare two versions of a dataset and return a structured report."""
    old_columns = list(old_df.columns)
    new_columns = list(new_df.columns)

    old_set = set(old_columns)
    new_set = set(new_columns)

    common_columns = sorted(old_set & new_set)
    removed_columns = sorted(old_set - new_set)
    added_columns = sorted(new_set - old_set)

    changes = []

    # Compare columns with the same name.
    for column in common_columns:
        old_summary = _column_summary(old_df[column])
        new_summary = _column_summary(new_df[column])

        if old_summary["inferredType"] != new_summary["inferredType"]:
            changes.append({
                "changeType": "type_changed",
                "column": column,
                "oldValue": old_summary["inferredType"],
                "newValue": new_summary["inferredType"],
                "confidence": 1.0,
                "explanation": "The inferred data type changed between versions.",
            })

        if old_summary["valuePattern"] != new_summary["valuePattern"]:
            changes.append({
                "changeType": "value_pattern_changed",
                "column": column,
                "oldValue": old_summary["valuePattern"],
                "newValue": new_summary["valuePattern"],
                "confidence": 1.0,
                "explanation": (
                    "The dominant value pattern changed. "
                    "Check representative values before drawing conclusions."
                ),
            })

        # Detect changes in categorical values and their distributions.
        old_unique_count = old_df[column].nunique()
        new_unique_count = new_df[column].nunique()

        # Restrict this check to columns with a manageable number of categories.
        if (
    max(old_unique_count, new_unique_count) <= 50
    and old_summary["inferredType"] not in {"integer", "numeric"}
    and new_summary["inferredType"] not in {"integer", "numeric"}
):
            categorical = _categorical_change(
                old_df[column],
                new_df[column],
            )

            if (
                categorical["addedCategories"]
                or categorical["removedCategories"]
                or categorical["distributionChanges"]
            ):
                changes.append({
                    "changeType": "categorical_values_changed",
                    "column": column,
                    **categorical,
                    "confidence": 1.0,
                    "explanation": (
                        "Categories or their distributions changed between versions. "
                        "Review whether this reflects a legitimate business change."
                    ),
                })


        old_nulls = old_summary["nullPercentage"]
        new_nulls = new_summary["nullPercentage"]

        if abs(new_nulls - old_nulls) >= 10:
            changes.append({
                "changeType": "null_percentage_changed",
                "column": column,
                "oldValue": old_nulls,
                "newValue": new_nulls,
                "confidence": 1.0,
                "explanation": "The percentage of empty values changed by at least 10 points.",
            })

    # Generate possible rename candidates from removed and added columns.
    rename_candidates = []

    for old_name, new_name in product(removed_columns, added_columns):
        name_score = _name_similarity(old_name, new_name)
        overlap_score = _value_overlap(old_df[old_name], new_df[new_name])

        old_type = _infer_type(old_df[old_name])
        new_type = _infer_type(new_df[new_name])
        same_type = old_type == new_type

        # Conservative heuristic: similar names, or matching values and types.
        if name_score >= 0.55 or (overlap_score >= 0.50 and same_type):
            score = max(
                name_score,
                (overlap_score + (1.0 if same_type else 0.0)) / 2,
            )

            rename_candidates.append({
                "oldColumn": old_name,
                "newColumn": new_name,
                "nameSimilarity": round(name_score, 3),
                "valueOverlap": round(overlap_score, 3),
                "sameInferredType": same_type,
                "confidence": round(score, 3),
                "status": "possible_rename_requires_review",
                "explanation": (
                    "This pair may represent a renamed column. "
                    "Confirm using business definitions and data context."
                ),
            })

    
    # Separate likely rename candidates from genuine additions/removals.
    # A candidate is still unconfirmed and must be reviewed by a user.
    matched_old = set()
    matched_new = set()

    for candidate in sorted(
        rename_candidates,
        key=lambda item: (
            item["valueOverlap"],
            item["nameSimilarity"],
            item["confidence"],
        ),
        reverse=True,
    ):
        old_name = candidate["oldColumn"]
        new_name = candidate["newColumn"]

        if old_name not in matched_old and new_name not in matched_new:
            matched_old.add(old_name)
            matched_new.add(new_name)

    likely_renames = [
        candidate
        for candidate in rename_candidates
        if candidate["oldColumn"] in matched_old
        and candidate["newColumn"] in matched_new
    ]

    remaining_added = [
        name for name in added_columns if name not in matched_new
    ]
    remaining_removed = [
        name for name in removed_columns if name not in matched_old
    ]
    row_comparison = _compare_rows(old_df, new_df)
    

    return {
        "status": "compared",
        "oldVersion": {
            "rowCount": len(old_df),
            "columnCount": len(old_columns),
        },
        "newVersion": {
            "rowCount": len(new_df),
            "columnCount": len(new_columns),
        },
       "addedColumns": remaining_added,
"removedColumns": remaining_removed,
"possibleRenames": likely_renames,
        "commonColumns": common_columns,
        "changes": changes,
        "rowChanges": row_comparison,
        "possibleRenames": rename_candidates,
        "limitations": [
            "Column-name and value-overlap scores are heuristic signals.",
            "Semantic changes require business definitions or additional context.",
            "An inferred type or value pattern does not establish business meaning.",
        ],
    }
