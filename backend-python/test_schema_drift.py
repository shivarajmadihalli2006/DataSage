
import pandas as pd

from app.schema_drift.comparison import compare_dataframes

# Old dataset
old_df = pd.DataFrame({
    "customer_id": ["101", "102", "103"],
    "email": [
        "alice@example.com",
        "bob@example.com",
        "carol@example.com",
    ],
    "age": ["25", "30", "35"],
})

# New dataset
new_df = pd.DataFrame({
    "customer_id": ["101", "102", "103"],
    "email_address": [
        "alice@example.com",
        "bob@example.com",
        "carol@example.com",
    ],
    "age": ["25", "unknown", "35"],
    "city": ["Belagavi", "Bengaluru", "Mysuru"],
})
old_df["status"] = ["active", "active", "inactive"]
new_df["status"] = ["paid", "paid", "unpaid"]
report = compare_dataframes(old_df, new_df)

print("\n=== SCHEMA DRIFT REPORT ===")
print(f"Added columns: {report['addedColumns']}")
print(f"Removed columns: {report['removedColumns']}")
print(f"Common columns: {report['commonColumns']}")

print("\nDetected changes:")
for change in report["changes"]:
    print(change)

print("\nPossible renames:")
for rename in report["possibleRenames"]:
    print(rename)



from app.schema_drift.comparison import _categorical_change

old_status = pd.Series(["active", "active", "inactive", "inactive"])
new_status = pd.Series(["paid", "paid", "unpaid", "unpaid"])

print("\n=== CATEGORICAL CHANGE TEST ===")
print(_categorical_change(old_status, new_status))
