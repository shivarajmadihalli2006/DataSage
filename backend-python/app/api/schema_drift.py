
"""API endpoint for comparing two CSV versions."""

from __future__ import annotations
from app import _vendor_path  # noqa: F401
from datasage_profiler.engine import DataProfiler
from app.adapters.phase1_adapter import adapt_profile_result
import io

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schema_drift.comparison import compare_dataframes
from app.schema_drift.rule_impact import analyze_rule_impact

router = APIRouter()


class SchemaDriftRequest(BaseModel):
    oldCsvContent: str = Field(min_length=1)
    newCsvContent: str = Field(min_length=1)


def _read_csv(content: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(
            io.StringIO(content),
            dtype=str,
            keep_default_na=False,
            na_filter=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse CSV: {exc}",
        ) from exc

    if len(df.columns) == 0:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain columns.",
        )

    if df.columns.duplicated().any():
        raise HTTPException(
            status_code=400,
            detail="CSV contains duplicate column names.",
        )

    return df


@router.post("/internal/schema-drift/compare")
async def post_schema_drift_compare(payload: SchemaDriftRequest):
    old_df = _read_csv(payload.oldCsvContent)
    new_df = _read_csv(payload.newCsvContent)

    report = compare_dataframes(old_df, new_df)
        # Run existing quality checks on the new CSV.
    profile_result = DataProfiler().profile({"uploaded_data": new_df})

    findings = adapt_profile_result(
        profile_result,
        {"uploaded_data": new_df},
    )

    # Convert the real findings into dictionaries for the analyzer.
    finding_records = [
        {
            "issue_type": finding.issue_type,
            "dimension": finding.dimension,
            "table": finding.table,
            "row_uid": finding.row_uid,
            "column": finding.column,
            "severity": finding.severity,
            "evidence": finding.evidence,
        }
        for finding in findings
    ]

    # Collect the schema changes already detected by the comparison engine.
    schema_changes = report.get("changes", [])

    # Initially, no existing quality findings are supplied by this endpoint.
    # The analyzer will identify potential rule impacts from schema changes.
    
    rule_impacts = analyze_rule_impact(
        schema_changes=report.get("changes", []),
        findings=finding_records,
    )

    report["ruleImpacts"] = rule_impacts

    return report
