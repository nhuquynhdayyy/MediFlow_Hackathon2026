from __future__ import annotations

import json
from pathlib import Path

from app.services.mock_data_store import DEPARTMENT_SEEDS, EMR_MOCK, HOURLY_PATTERN


def main() -> None:
    output = {
        "departments": [
            {
                "department": d.name,
                "doctors": d.doctors,
                "avg_service_minutes": d.avg_service_minutes,
                "base_waiting": d.base_waiting,
                "floor": d.floor,
            }
            for d in DEPARTMENT_SEEDS
        ],
        "hourly_pattern": HOURLY_PATTERN,
        "emr_mock": EMR_MOCK,
    }
    target = Path(__file__).resolve().parent.parent / "mock_data.generated.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated mock data at: {target}")


if __name__ == "__main__":
    main()
