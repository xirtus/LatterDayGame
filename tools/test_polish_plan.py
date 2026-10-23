import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("polish_plan", ROOT / "tools/build_polish_plan.py")
plan_builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan_builder)


class PolishPlanTests(unittest.TestCase):
    def test_every_runtime_speaker_is_in_preparation_queue(self):
        rows = plan_builder.voice_rows()
        expected = {line["speaker_id"] for line in plan_builder.LINES}
        self.assertEqual({row["speaker_id"] for row in rows}, expected)
        self.assertEqual(len(rows), len(expected))
        self.assertEqual(sum(row["current_line_count"] for row in rows), len(plan_builder.LINES))
        self.assertTrue(all(row["voice_description"] and row["audition_text"] for row in rows))

    def test_profile_sharing_preserves_distinct_people(self):
        rows = {row["speaker_id"]: row for row in plan_builder.voice_rows()}
        self.assertEqual(rows["JOSEPH_YOUNG"]["base_voice_id"], rows["JOSEPH_MATURE"]["base_voice_id"])
        self.assertNotEqual(rows["JOSEPH_YOUTH"]["base_voice_id"], rows["JOSEPH_MATURE"]["base_voice_id"])
        self.assertEqual(rows["MORONI"]["base_voice_id"], rows["MORONI_RECORD_KEEPER"]["base_voice_id"])
        self.assertNotEqual(rows["CAPTAIN_MORONI"]["base_voice_id"], rows["MORONI"]["base_voice_id"])
        self.assertNotEqual(rows["FATHER"]["base_voice_id"], rows["CHRIST"]["base_voice_id"])
        self.assertNotEqual(rows["JOHN_TAYLOR"]["base_voice_id"], rows["JAMES"]["base_voice_id"])

    def test_preparation_edits_survive_regeneration(self):
        original = plan_builder.DOCS
        with tempfile.TemporaryDirectory() as temporary:
            plan_builder.DOCS = Path(temporary)
            try:
                row = plan_builder.voice_rows()[0]
                row.update({"setup_status": "Approved by user", "reference_filename": "my-existing-voice.wav", "consent_reference": "release-42", "notes": "Keep the gentler delivery"})
                plan_builder.write_csv(plan_builder.DOCS / "voice-preparation.csv", [row])
                updated = next(item for item in plan_builder.voice_rows() if item["speaker_id"] == row["speaker_id"])
                for field in plan_builder.EDITABLE:
                    self.assertEqual(updated[field], row[field])
            finally:
                plan_builder.DOCS = original

    def test_all_chapters_have_real_assignments_and_correct_hiram_id(self):
        rows = plan_builder.scene_rows()
        self.assertEqual({row["chapter_id"] for row in rows}, {chapter["id"] for chapter in plan_builder.DATA["chapters"]})
        self.assertEqual(len(rows), 70)
        for row in rows:
            self.assertTrue(row["architecture_kit"] and row["npc_life"] and row["emotional_light_arc"])
        self.assertIn("Hiram", next(row for row in rows if row["chapter_id"] == "15")["architecture_kit"])
        self.assertNotIn("Hiram", next(row for row in rows if row["chapter_id"] == "16")["architecture_kit"])

    def test_lighting_rollout_closes_the_original_plan_gaps(self):
        rows = plan_builder.scene_rows()
        missing = {row["chapter_id"] for row in rows if row["existing_preset_id"] == "MISSING"}
        self.assertEqual(missing, set())
        document = json.loads((ROOT / "docs/polish-overhaul-plan.json").read_text())
        self.assertFalse(document["lighting"]["gameplay_integration"])
        self.assertEqual(document["voice"]["game_discovered_takes"], 0)

    def test_backlog_is_not_misrepresented_as_current_script(self):
        with (ROOT / "docs/voice-next-roles.csv").open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        current = {line["speaker_id"] for line in plan_builder.LINES}
        self.assertTrue(all(row["voice_id"] not in current for row in rows))
        self.assertTrue(any(row["voice_id"] == "MOB_LEAD" for row in rows))
        self.assertTrue(any(row["voice_id"] == "LEMUEL" for row in rows))


if __name__ == "__main__":
    unittest.main()
