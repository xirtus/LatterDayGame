import json
import unittest

from build_game_assets import COMPOSITE_IDS, PATTERNS, ROOT, age_preference, christ_variant, inspect, matches, orson_age


class ChristWardrobeDiscoveryTests(unittest.TestCase):
    def test_skeleton_without_skin_weights_is_not_a_rigged_character(self):
        broken = inspect(ROOT / "meshy/peter_whitmer_jr_rigged.glb")
        repaired = inspect(ROOT / "meshy/Meshy_AI_peter_whitmer_jr_reri_All_Animations.glb")
        self.assertFalse(broken["rigged"])
        self.assertTrue(repaired["rigged"])
        self.assertLess(age_preference("PETER_WHITMER_JR", repaired), age_preference("PETER_WHITMER_JR", broken))
        manifest = json.loads((ROOT / "game/content/assets.json").read_text())
        self.assertEqual(manifest["characters"]["PETER_WHITMER_JR"]["asset"]["file"], repaired["file"])

    def test_black_saints_are_not_biblical_or_family_namesakes(self):
        self.assertTrue(matches("ELIJAH_ABLE", "Elijah_Abel_Rigged.glb"))
        self.assertTrue(matches("ELIJAH_ABLE", "Meshy_AI_Elijah_Able_All_Animations.glb"))
        self.assertFalse(matches("ELIJAH", "Elijah_Abel_Rigged.glb"))
        self.assertTrue(matches("ELIJAH", "Meshy_AI_Elijah_Rigged_All_Animations.glb"))
        self.assertTrue(matches("JANE_MANNING", "Jane_Manning_James_Rigged.glb"))
        self.assertFalse(matches("JAMES", "Jane_Manning_James_Rigged.glb"))
        self.assertFalse(matches("JAMES", "James_K_Polk_Rigged.glb"))
        self.assertTrue(matches("WALKER_LEWIS", "Quack_Walker_Lewis_Rigged.glb"))
        self.assertFalse(matches("WALKER_LEWIS", "Lewis_Whitmer_Rigged.glb"))
        self.assertFalse(matches("ELIZA", "Eliza_Manning_Rigged.glb"))
        self.assertTrue(matches("WW_PHELPS", "William_W_Phelps_Rigged.glb"))

    def test_common_names_and_colors(self):
        examples = [
            ("Meshy_AI_Jesus_White_Robe_Rigged.glb", "white"),
            ("jesus-redcoat.glb", "red"),
            ("ChristRedCoat.glb", "red"),
            ("SaviourWhiteRobe.glb", "white"),
            ("Savior_red_Rigged.glb", "red"),
        ]
        for filename, color in examples:
            with self.subTest(filename=filename):
                self.assertEqual(christ_variant(filename), color)
                self.assertTrue(matches("CHRIST", filename))
                self.assertTrue(matches("CHRIST_" + color.upper(), filename))
                opposite = "red" if color == "white" else "white"
                self.assertFalse(matches("CHRIST_" + opposite.upper(), filename))

    def test_not_another_character_or_ambiguous_color(self):
        self.assertFalse(matches("CHRIST", "Christian_Whitmer.glb"))
        self.assertFalse(matches("CHRIST_WHITE", "John_Whitmer_Rigged.glb"))
        self.assertIsNone(christ_variant("Sacred_Christ_Rigged.glb"))
        self.assertFalse(matches("CHRIST", "Meshy_AI_mormon_prophet_rigged.glb"))

    def test_visually_verified_ambiguous_exports(self):
        self.assertTrue(matches("CHRIST_RED", "Meshy_AI_mormon_rigged_All_Animations.glb"))
        self.assertTrue(matches("CHRIST_WHITE", "Meshy_AI_mormon_jesus_optimize_1022123833_texture.glb"))
        self.assertTrue(matches("CHRIST_WHITE", "Meshy_AI_mormon_jesus_rigged_All_Animations.glb"))

    def test_white_default_not_smallest_red(self):
        white = {"file": "Jesus_White_Robe.glb", "triangles": 10000, "rigged": True, "bytes": 20000000}
        red = {"file": "Jesus_Red_Robe.glb", "triangles": 10000, "rigged": True, "bytes": 1000000}
        self.assertLess(age_preference("CHRIST", white), age_preference("CHRIST", red))

    def test_optimized_fallback_before_unoptimized_white(self):
        white = {"file": "Jesus_White_Robe.glb", "triangles": 580000, "rigged": False, "bytes": 30000000}
        red = {"file": "Jesus_Red_Robe.glb", "triangles": 10000, "rigged": True, "bytes": 20000000}
        self.assertLess(age_preference("CHRIST", red), age_preference("CHRIST", white))

    def test_child_and_youth_do_not_share_filename_matching(self):
        self.assertTrue(matches("JOSEPH_CHILD", "child_joseph_smith_rigged.glb"))
        self.assertFalse(matches("JOSEPH_YOUTH", "child_joseph_smith_rigged.glb"))
        self.assertTrue(matches("JOSEPH_YOUTH", "teenage_joseph_smith.glb"))
        self.assertFalse(matches("JOSEPH_MATURE", "teenage_joseph_smith.glb"))

    def test_hyrum_page_filename_does_not_replace_hyrum_smith(self):
        self.assertFalse(matches("HYRUM", "Meshy_AI_Hyrum_Page_Rigged.glb"))
        self.assertTrue(matches("HIRAM_PAGE", "Meshy_AI_Hyrum_Page_Rigged.glb"))
        self.assertTrue(matches("HYRUM", "Meshy_AI_Hyrum_Smith_Rigged.glb"))
        self.assertFalse(matches("HIRAM_PAGE", "Meshy_AI_Hyrum_Smith_Rigged.glb"))

    def test_every_voice_role_has_an_explicit_import_strategy(self):
        cast = json.loads((ROOT / "docs/cast.json").read_text())
        missing = {entry["id"] for entry in cast} - PATTERNS.keys() - COMPOSITE_IDS
        self.assertEqual(missing, set())

    def test_named_historical_and_future_cast(self):
        examples = {
            "NEWEL_KNIGHT": "Newel_Knight", "WHITNEY": "Newel_K_Whitney",
            "ELIZABETH_WHITNEY": "Elizabeth_Ann_Whitney", "LOUISA": "Louisa_Tanner_Follett",
            "WILFORD": "Wilford_Woodruff", "HEBER": "Heber_C_Kimball",
            "SARAH_CLEVELAND": "Sarah_M_Cleveland", "EDWARD_PARTRIDGE": "Edward_Partridge",
            "WILLIAM_CLAYTON": "William_Clayton", "THOMAS_BULLOCK": "Thomas_Bullock",
            "JONAS": "Abraham_Jonas", "VAN_BUREN": "Martin_Van_Buren", "FORD": "Governor_Thomas_Ford",
            "WILLIAM_LAW": "William_Law", "ISAAC_HALE": "Isaac_Hale", "GRANDIN": "Egbert_B_Grandin",
            "FUTURE_GUIDE": "Miriam", "FUTURE_SCIENTIST": "Elias_Vale", "MISSIONARY_1955": "Ruth",
            "ARCHIVIST_1994": "Daniel", "CARETAKER_2026": "Ada", "SURVIVOR": "Mara",
        }
        for identity, name in examples.items():
            with self.subTest(identity=identity):
                self.assertTrue(matches(identity, "Meshy_AI_" + name + "_Rigged_All_Animations.glb"))

    def test_similar_named_people_do_not_swap_identities(self):
        negatives = {
            "PETER": ["Peter_Whitmer_Sr", "Peter_Whitmer_Jr"],
            "JAMES": ["James_Taylor", "JamesTaylor"],
            "JOHN": ["John_Whitmer", "John_Taylor", "John_The_Baptist", "John_Johnson"],
            "ELIAS": ["Elias_Vale"], "WHITNEY": ["Elizabeth_Ann_Whitney"],
            "PETER_WHITMER": ["Peter_Whitmer_Jr", "Peter_Whitmer_Junior", "Peter_Whitmer"],
            "PETER_WHITMER_JR": ["Peter_Whitmer_Sr", "Peter_Whitmer_Senior", "Peter_Whitmer"],
            "CARETAKER_2026": ["Adam"], "MISSIONARY_1955": ["Truth"],
            "FORD": ["Henry_Ford"], "ORSON": ["Orson_Hyde"],
        }
        for identity, names in negatives.items():
            for name in names:
                with self.subTest(identity=identity, name=name):
                    self.assertFalse(matches(identity, "Meshy_AI_" + name + "_Rigged.glb"))
        self.assertTrue(matches("PETER", "Meshy_AI_Peter_Apostle_Rigged.glb"))
        self.assertTrue(matches("JAMES", "Meshy_AI_James_Apostle_Rigged.glb"))
        self.assertTrue(matches("JOHN", "Meshy_AI_John_Apostle_Rigged.glb"))
        self.assertTrue(matches("ELIAS", "Meshy_AI_Elias_Rigged.glb"))
        self.assertTrue(matches("PETER_WHITMER", "Meshy_AI_Peter_Whitmer_Sr_Rigged.glb"))
        self.assertTrue(matches("PETER_WHITMER_JR", "Meshy_AI_Peter_Whitmer_Jr_Rigged.glb"))

    def test_composite_roles_require_explicit_role_filenames(self):
        for identity in COMPOSITE_IDS:
            self.assertTrue(matches(identity, f"Meshy_AI_{identity}_Rigged_All_Animations.glb"))
        self.assertTrue(matches("CHILD", "Meshy_AI_Composite_Child_Rigged.glb"))
        self.assertFalse(matches("CHILD", "Meshy_AI_child_joseph_smith_rigged.glb"))
        self.assertFalse(matches("METHODIST", "Meshy_AI_Methodist_Church_Model.glb"))

    def test_orson_age_variants_do_not_replace_early_ministry(self):
        young = {"file": "Meshy_AI_Orson_Pratt_Rigged_All_Animations.glb", "triangles": 10000, "rigged": True, "bytes": 20000000}
        elder = {"file": "Meshy_AI_Elderly_Orson_Pratt_R_All_Animations.glb", "triangles": 10000, "rigged": True, "bytes": 1000000}
        self.assertEqual(orson_age(young["file"]), "young")
        self.assertEqual(orson_age(elder["file"]), "elder")
        self.assertLess(age_preference("ORSON", young), age_preference("ORSON", elder))
        self.assertTrue(matches("ORSON_YOUNG", young["file"]))
        self.assertFalse(matches("ORSON_YOUNG", elder["file"]))
        self.assertTrue(matches("ORSON_ELDER", elder["file"]))
        self.assertFalse(matches("ORSON_ELDER", young["file"]))
        self.assertFalse(matches("ORSON_ELDER", "Elderly_Orson_Hyde_Rigged.glb"))

    def test_user_confirmed_carthage_and_louisa_exports(self):
        for filename in ["James_Taylor_Rigged.glb", "Meshy_AI_James_Taylor_Rigged_All_Animations.glb"]:
            self.assertTrue(matches("JOHN_TAYLOR", filename))
            self.assertFalse(matches("JAMES", filename))
            self.assertFalse(matches("JOHN", filename))
        self.assertFalse(matches("JOHN_TAYLOR", "James_Taylor_Another_Unconfirmed_Model.glb"))
        self.assertTrue(matches("LOUISA", "Louisa Folett_rigged_All_Animations.glb"))


if __name__ == "__main__":
    unittest.main()
