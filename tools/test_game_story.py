import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "game/content/chapters.json").read_text())
CHAPTERS = {chapter["id"]: chapter for chapter in DATA["chapters"]}


class HistoricalSceneIntegrationTests(unittest.TestCase):
    def test_original_chapter_ids_remain_in_order(self):
        numeric_ids = [chapter["id"] for chapter in DATA["chapters"] if chapter["id"].isdigit()]
        self.assertEqual(numeric_ids, [f"{number:02d}" for number in range(1, 33)])
        self.assertEqual(DATA["coreCount"], 32)

    def test_documentary_insertions_are_explicit_and_chronological(self):
        identities = [chapter["id"] for chapter in DATA["chapters"]]
        self.assertEqual(identities[identities.index("15") + 1], "N1")
        self.assertEqual(identities[identities.index("26") + 1], "B1")
        self.assertEqual(CHAPTERS["N1"]["environment"], "manhattan")
        self.assertEqual(CHAPTERS["B1"]["environment"], "lowell")
        self.assertEqual(CHAPTERS["B1"]["playerId"], "WALKER_LEWIS")
        self.assertTrue(CHAPTERS["B1"]["documentary"])
        self.assertIn("not a memory or visit by Joseph", CHAPTERS["B1"]["perspective"])
        for objective in CHAPTERS["B1"]["objectives"]:
            self.assertTrue(all(line["speaker"] == "WALKER_LEWIS" for line in objective["lines"]))

    def test_elijahs_have_distinct_identity_and_visibility(self):
        actors = {person["id"]: person for person in CHAPTERS["20"]["actors"]}
        self.assertLess(actors["ELIJAH_ABLE"]["hideAfter"], actors["ELIJAH"]["showFrom"])
        self.assertTrue(any("Ambrose Palmer" in objective.get("note", "") for objective in CHAPTERS["20"]["objectives"]))

    def test_jane_arrives_after_the_1842_meeting(self):
        actors = {person["id"]: person for person in CHAPTERS["26"]["actors"]}
        self.assertGreater(actors["JANE_MANNING"]["showFrom"], actors["ELIZA"]["hideAfter"])
        self.assertIn("fall 1843", CHAPTERS["26"]["objectives"][actors["JANE_MANNING"]["showFrom"]]["label"])

    def test_late_campaign_follows_the_discourse(self):
        chapter = CHAPTERS["28"]
        self.assertIn("Louisa", chapter["objectives"][0]["label"])
        self.assertIn("April 9", chapter["objectives"][5]["label"])
        self.assertIn("May 13", chapter["objectives"][6]["label"])
        self.assertIn("May 17", chapter["objectives"][7]["label"])
        self.assertIn("May 29", chapter["objectives"][8]["note"])
        self.assertFalse(any("Polk" in objective["label"] for objective in CHAPTERS["27"]["objectives"]))

    def test_translation_keeps_record_covered_and_fayette_separate(self):
        chapter = CHAPTERS["08"]
        self.assertTrue(any("covered" in objective["label"] for objective in chapter["objectives"]))
        actors = {person["id"]: person for person in chapter["actors"]}
        self.assertEqual(actors["DAVID"]["showFrom"], len(chapter["objectives"]) - 1)

    def test_all_objective_speakers_and_point_keys_exist(self):
        expected_points = {"center", "gather", "study", "prayer", "journey", "left", "right"}
        for chapter in DATA["chapters"]:
            for objective in chapter["objectives"]:
                self.assertEqual(len(objective["target"]), 3)
                if "point" in objective:
                    self.assertIn(objective["point"], expected_points)
                for line in objective["lines"]:
                    self.assertIn(line["speaker"], DATA["names"])
                    self.assertTrue(line["lineId"])

    def test_runtime_recording_ids_are_unique(self):
        identities = [line["lineId"] for chapter in DATA["chapters"] for objective in chapter["objectives"] for line in objective["lines"]]
        self.assertEqual(len(identities), len(set(identities)))

    def test_inserted_objectives_have_explicit_legacy_progress_maps(self):
        self.assertEqual(CHAPTERS["08"]["objectiveMigrationV1"], [0, 2, 4, 6])
        self.assertEqual(CHAPTERS["20"]["objectiveMigrationV1"], [0, 1, 6, 7])
        self.assertEqual(CHAPTERS["27"]["objectiveMigrationV1"], [2, 5, 6])

    def test_record_chapters_remain_optional_and_separate(self):
        records = [chapter for chapter in DATA["chapters"] if chapter.get("record")]
        self.assertEqual(len(records), 28)
        self.assertEqual(DATA["recordCount"], 28)
        self.assertEqual([chapter["id"] for chapter in records], [f"BM{number:02d}" for number in range(1, 26)] + ["TX01", "TX02", "TX03"])
        self.assertEqual(len([chapter for chapter in DATA["chapters"] if not chapter.get("record")]), 42)
        for chapter in records:
            self.assertTrue(chapter["optional"])
            self.assertEqual(chapter["recordId"], chapter["id"])
            self.assertTrue(chapter["environment"].startswith("record-"))
            self.assertEqual(len(chapter["objectives"]), 4)
            self.assertTrue(chapter["sourceUrls"])
            self.assertIn(chapter["returnAtAnchor"], CHAPTERS)
            self.assertTrue(all(anchor in CHAPTERS for anchor in chapter["anchors"]))

    def test_record_activities_are_spatial_and_never_gate_prayer(self):
        activity_count = 0
        for chapter in DATA["chapters"]:
            for objective in chapter["objectives"]:
                if "activity" not in objective:
                    continue
                activity_count += 1
                activity = objective["activity"]
                self.assertIn(activity["type"], {"collect", "repair", "serve", "navigate", "observe", "arrange"})
                self.assertGreater(activity["count"], 0)
                self.assertLessEqual(activity["count"], 16)
                self.assertTrue(activity["label"])
                self.assertNotEqual(objective["kind"], "pray")
        self.assertGreater(activity_count, 25)
        self.assertEqual(CHAPTERS["BM06"]["objectives"][1]["activity"]["count"], 16)
        self.assertEqual(CHAPTERS["BM06"]["objectives"][3]["activity"]["count"], 8)

    def test_scriptural_identities_and_adaptation_boundaries(self):
        self.assertEqual(CHAPTERS["BM08"]["playerId"], "ENOS")
        self.assertEqual(CHAPTERS["BM15"]["playerId"], "CAPTAIN_MORONI")
        self.assertEqual(CHAPTERS["BM25"]["playerId"], "MORONI_RECORD_KEEPER")
        self.assertNotEqual(CHAPTERS["BM15"]["playerId"], CHAPTERS["BM25"]["playerId"])
        self.assertIn("later night", CHAPTERS["BM18"]["objectives"][3]["label"].lower())
        self.assertIn("did not return", CHAPTERS["BM18"]["objectives"][3]["lines"][0]["text"])
        self.assertIn("millions", CHAPTERS["TX03"]["objectives"][0]["lines"][0]["text"])
        for chapter in DATA["chapters"]:
            if chapter.get("record"):
                self.assertEqual(chapter["speculative"], chapter["id"].startswith("TX"))
                for objective in chapter["objectives"]:
                    for line in objective["lines"]:
                        self.assertIn("not a scriptural quotation", line["direction"])

    def test_record_locations_are_concise_and_durations_not_invented(self):
        for chapter in DATA["chapters"]:
            if chapter.get("record"):
                self.assertLess(len(chapter["place"]), 85)
                self.assertTrue(chapter["locationDescription"])
                self.assertNotIn("minutes", chapter)

    def test_key_encounters_have_purposeful_dialogue_and_visible_speakers(self):
        for identity, index in [("BM02", 3), ("BM06", 2), ("BM12", 3), ("BM21", 2), ("BM25", 1)]:
            chapter = CHAPTERS[identity]
            lines = chapter["objectives"][index]["lines"]
            self.assertGreaterEqual(len(lines), 2)
            for line in lines:
                if line["speaker"] == chapter["playerId"]:
                    continue
                actors = {person["id"]: person for person in chapter["actors"]}
                self.assertIn(line["speaker"], actors)
                self.assertLessEqual(actors[line["speaker"]].get("showFrom", 0), index)
                self.assertGreaterEqual(actors[line["speaker"]].get("hideAfter", 99), index)
        for identity in ["BM06", "BM21"]:
            encounter = CHAPTERS[identity]["objectives"][2]["lines"]
            self.assertTrue(any(line["speaker"] == "CHRIST" and "I am Jesus Christ" in line["text"] for line in encounter))

    def test_staged_viewpoints_keep_bound_nephi_and_distinct_commanders(self):
        self.assertEqual(CHAPTERS["BM05"]["playerStages"], ["NEPHI", "SARIAH", "NEPHI", "NEPHI"])
        self.assertEqual(CHAPTERS["BM15"]["playerStages"], ["CAPTAIN_MORONI", "CAPTAIN_MORONI", "LEHI_COMMANDER", "LEHI_COMMANDER"])
        self.assertEqual(CHAPTERS["BM24"]["playerStages"], ["MORMON", "MORMON", "MORONI_RECORD_KEEPER", "MORONI_RECORD_KEEPER"])
        for chapter in DATA["chapters"]:
            if "playerStages" in chapter:
                self.assertEqual(len(chapter["playerStages"]), len(chapter["objectives"]))
                self.assertTrue(all(identity in DATA["names"] for identity in chapter["playerStages"]))
                self.assertEqual(chapter["playerStages"][-1], "MORONI_RECORD_KEEPER" if chapter["id"] == "BM24" else "LEHI_COMMANDER" if chapter["id"] == "BM15" else "NEPHI")


if __name__ == "__main__":
    unittest.main()
