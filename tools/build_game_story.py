from pathlib import Path
import json
from build_record_story import build_record_chapters, CAST as RECORD_CAST


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUTPUT = ROOT / "game" / "content"
campaign = json.loads((DOCS / "campaign.json").read_text())
dialogue = {entry["scene"]: entry["lines"] for entry in json.loads((DOCS / "dialogue.json").read_text())}
dialogue["28"][7:7] = json.loads((DOCS / "sermon-passages.json").read_text())
sources = json.loads((DOCS / "sources.json").read_text())
names = {person["id"]: person["name"] for person in json.loads((DOCS / "cast.json").read_text())}
names.update({
    "CHRISTIAN_WHITMER": "Christian Whitmer",
    "JACOB_WHITMER": "Jacob Whitmer",
    "PETER_WHITMER_JR": "Peter Whitmer Jr.",
    "JOHN_WHITMER": "John Whitmer",
    "HIRAM_PAGE": "Hiram Page",
    "SAMUEL_SMITH": "Samuel H. Smith",
})
names.update({person["id"]: person["name"] for person in RECORD_CAST})

POINTS = {
    "center": [0, 0, 0],
    "gather": [-4, 0, 1],
    "study": [3, 0, -2],
    "prayer": [0, 0, -5],
    "journey": [0, 0, 13],
    "left": [-7, 0, -3],
    "right": [7, 0, -3],
}


def objective(label, point, kind, prompt, script=None, effect=None, note=None):
    result = {
        "label": label,
        "target": POINTS[point] if isinstance(point, str) else point,
        "kind": kind,
        "prompt": prompt,
        "script": script or [],
    }
    if isinstance(point, str):
        result["point"] = point
    if effect:
        result["effect"] = effect
    if note:
        result["note"] = note
    return result


def actor(identity, position, show=0, hide=None, height=None):
    result = {"id": identity, "position": position, "rotation": 0, "showFrom": show}
    if hide is not None:
        result["hideAfter"] = hide
    if height:
        result["height"] = height
    return result


def extra(speaker, text, direction="Original dramatic adaptation; not a historical quotation."):
    return {"speaker": speaker, "text": text, "direction": direction}


PLANS = {
    "01": ("bedroom", [
        objective("Ask your father to stay", "gather", "talk", "Call softly for your father", [0, 1]),
        objective("Accept Lucy's care", "study", "serve", "Reach for the water and accept help", [2], "comfort"),
        objective("Take a supported step", "center", "travel", "Take the next step with your family", [extra("JOSEPH_CHILD", "I am ready to try, if you will stay beside me.")]),
    ]),
    "02": ("town", [
        objective("Listen at the Methodist gathering", "gather", "talk", "Ask the minister about faith", [0]),
        objective("Hear the Presbyterian minister", "study", "talk", "Bring your question about scripture", [1]),
        objective("Speak with the Baptist minister", "right", "talk", "Listen before deciding", [2]),
        objective("Seek wisdom in scripture", "prayer", "inspect", "Open the passage about asking God", [3], "light"),
    ]),
    "03": ("grove", [
        objective("Find a quiet place in the grove", "gather", "travel", "Set aside the competing voices", [extra("JOSEPH_YOUTH", "Here, away from the road, I can give my whole attention to prayer.")]),
        objective("Kneel and ask God", "prayer", "pray", "Hold to kneel and pray; take your time", [0], "revelation"),
        objective("Attend to the Father and the Son", "center", "listen", "Look toward the light and listen", [1, 2, 3], "light"),
        objective("Carry the answer home", "journey", "travel", "Return through the same ordinary trees", [extra("JOSEPH_YOUTH", "I came with a question. I will remember what I have received.")]),
    ]),
    "04": ("bedroom", [
        objective("Pray beside the bed", "study", "pray", "Kneel for a quiet evening prayer", [extra("JOSEPH_YOUTH", "Heavenly Father, forgive my weakness and help me know my duty.")], "light"),
        objective("Hear Moroni's message", "center", "listen", "Attend to the messenger in the loft", [0, 1], "revelation"),
        objective("Remember the repeated instruction", "prayer", "inspect", "Gather the message into memory", [extra("JOSEPH_YOUTH", "A record, a hill, and a responsibility. I must not forget.")]),
        objective("Tell your father in the morning", "gather", "talk", "Share what you have heard", [2]),
    ]),
    "05": ("hill", [
        objective("Approach the stone box", "center", "inspect", "Uncover the entrusted record without taking it", [0], "plates"),
        objective("Receive the charge to prepare", "prayer", "listen", "Accept that the time has not yet come", [extra("JOSEPH_YOUTH", "I will return as instructed, and attend to the work before me.")]),
        objective("Remember Alvin's kindness", "gather", "talk", "Remember the brother who shared the heavy work", [1]),
        objective("Sit with the grieving family", "study", "serve", "Remain with Lucy rather than hurry past sorrow", [2, 3], "comfort"),
    ]),
    "06": ("farm", [
        objective("Speak plainly with Emma's father", "gather", "talk", "Hear Isaac Hale's concern", [0]),
        objective("Make your commitment to Emma", "study", "talk", "Listen to Emma and promise honest counsel", [1, 2], "comfort"),
        objective("Receive the plates · September 22, 1827", "center", "inspect", "Wrap and protect the entrusted record", [3], "plates"),
        objective("Prepare to leave for Harmony", "journey", "serve", "Secure the record and ready the journey", [extra("EMMA", "We have prepared what we can. Now we must take care of one another on the road.")]),
    ]),
    "07": ("harmony", [
        objective("Prepare the writing place", "study", "inspect", "Arrange paper and the translation workspace", [extra("EMMA", "There is quiet now. I can write while the household rests.")]),
        objective("Face the loss of the manuscript", "gather", "talk", "Listen to Martin without turning away", [0]),
        objective("Pray in repentance", "prayer", "pray", "Acknowledge responsibility and ask for help", [1], "light"),
        objective("Remain beside Emma", "center", "serve", "Share the grief of the household", [2], "comfort"),
    ]),
    "08": ("harmony", [
        objective("Welcome Oliver to the work", "gather", "talk", "Make room for the new scribe", [extra("OLIVER", "I have come to help. Show me where I should begin.")]),
        objective("Prepare the writing place", "study", "serve", "Arrange paper, ink, quill and a place for the scribe", [extra("OLIVER", "The paper is ready. I will write what you dictate, and we can attend to it together.")]),
        objective("Attend to the stone, hat and covered record", "study", "inspect", "Examine the ordinary objects without uncovering the plates", [extra("JOSEPH_YOUNG", "The gift is God's. Let us approach the work with care.")], "light", "Accounts describe the interpreters and a seer stone with a hat to exclude light. The plates remain covered here; this is not a cipher puzzle or a claim that every session used the same arrangement."),
        objective("Take a quiet moment before dictation", "prayer", "pray", "Seek guidance without treating revelation as a machine", [extra("JOSEPH_YOUNG", "Heavenly Father, help us receive with humility and carry this work faithfully.")], "light"),
        objective("Dictate and hear the read-back", "center", "speak", "Speak carefully, then listen to Oliver", [0, 1], "light"),
        objective("Pause for the household", "gather", "talk", "Listen when Emma returns to the room", [extra("EMMA", "I can keep this place quiet for a little while. Tell me what you need before you continue."), extra("JOSEPH_YOUNG", "Thank you. Let us not forget the work you carry alongside this work.")], "comfort", "Original household conversation informed by translation accounts; not a verbatim exchange witnessed in 1829."),
        objective("Accept the Whitmer family's welcome", "journey", "talk", "Continue the work at Fayette after a dated journey", [2, 3]),
    ]),
    "09": ("river", [
        objective("Bring the question of baptism to God", "prayer", "pray", "Kneel beside Oliver near the river", [extra("OLIVER", "Let us ask together what God would have us do.")], "revelation"),
        objective("Receive John the Baptist's commission", "center", "listen", "Attend to authority as a responsibility to serve", [0], "light"),
        objective("Approach the water with Oliver", "gather", "serve", "Prepare reverently for baptism", [1]),
        objective("A subsequent apostolic encounter", "study", "listen", "Receive the apostles' charge to serve in love", [2, 3, 4], "light", "A separate subsequent encounter; its exact date is not fixed here."),
    ]),
    "10": ("witnesses", [
        objective("Pray with the Three Witnesses", "prayer", "pray", "Pray with Oliver, David, and Martin", [extra("JOSEPH_YOUNG", "Let us prepare our hearts to receive a witness from God.")], "revelation", "The Three Witnesses' angelic encounter is separate from the Eight Witnesses' handling of the plates."),
        objective("Hear the Three bear witness", "center", "listen", "Attend to the angelic witness", [0, 1], "plates"),
        objective("The Eight · show the plates", "center", "inspect", "Let all eight examine and handle the plates", [extra("HYRUM", "We will speak plainly of what we have seen and handled.")], "plates", "No angel appears in this separate Eight Witnesses scene. They examine the plates; they do not translate their text."),
        objective("Listen to the Eight's testimony", "gather", "talk", "Acknowledge each of the eight witnesses", [extra("JOSEPH_YOUNG", "Christian, Jacob, Peter, John, Hiram, Father, Hyrum, and Samuel: let your witness be your own.")]),
        objective("Place the printed book in another hand", "study", "serve", "Inspect the print sheet, then share the finished book", [2, 3], "light", "A dated transition to Grandin's print shop; first publication is March 1830."),
    ]),
    "11": ("farm", [
        objective("Prepare the founding gathering", "center", "serve", "Make room for the gathered households", [extra("PETER_WHITMER", "There is room here. Let the families come in.")]),
        objective("Participate in the Church's organization", "gather", "speak", "Join the sustaining and shared worship", [0]),
        objective("Teach the first New York congregation", "prayer", "speak", "Speak to questions, not to an anonymous crowd", [1]),
        objective("Walk beside Emma after baptism", "study", "talk", "Hear her hopes for worship and hymns", [2], "comfort"),
        objective("Face an early arrest with support", "journey", "listen", "Carry faith through uncertainty without seeking a fight", [extra("OFFICER", "You must come with me while this complaint is heard."), 3]),
    ]),
    "12": ("kirtland", [
        objective("Arrive at Whitney's store", "gather", "talk", "Accept a welcome in Kirtland", [0]),
        objective("Find room for the newcomers", "study", "serve", "Set aside provisions and a place to sleep", [1], "comfort"),
        objective("Plan a people of mutual care", "center", "speak", "Discuss food, work, and fair stewardship", [2, 3]),
    ]),
    "13": ("missouri", [
        objective("Walk the land at Independence", "journey", "travel", "Consider the place and its existing neighbors", [extra("JOSEPH_YOUNG", "A city is more than a plan upon the ground. It must be a people who care for one another.")]),
        objective("Pray at the place for Zion", "prayer", "pray", "Dedicate the work to God", [1], "light"),
        objective("Place the first survey stake", "center", "serve", "Begin a practical plan for gathering", [2]),
        objective("Count the households needing shelter", "study", "talk", "Attend to Edward Partridge's report", [0], "comfort"),
    ]),
    "14": ("harmony", [
        objective("Study beside Sidney", "study", "inspect", "Read and bring the question into prayer", [0]),
        objective("Ask for understanding", "prayer", "pray", "Kneel without trying to judge other souls", [extra("JOSEPH_YOUNG", "Open our understanding, that we may receive what Thou wouldst teach us.")], "revelation"),
        objective("Receive the vision of eternity", "center", "listen", "Attend to the teaching of heavenly glory", [1, 2], "stars"),
    ]),
    "15": ("bedroom", [
        objective("Accept help after the assault", "gather", "serve", "Let the household bring water and stay beside you", [0], "comfort", "The March 24–25 assault and tarring are conveyed through aftermath rather than a graphic button challenge."),
        objective("Hear Emma's grief and resolve", "study", "talk", "Remain and listen to Emma", [1]),
        objective("Prepare to face the congregation", "center", "pray", "Seek strength rather than revenge", [2], "light"),
        objective("Go out to teach", "journey", "travel", "Carry care into the morning", [extra("JOSEPH_YOUNG", "There are people waiting. I will go to them.")]),
    ]),
    "16": ("kirtland", [
        objective("Prepare the schoolroom", "study", "serve", "Clean and arrange the place of learning", [1]),
        objective("Hear Emma's concern", "gather", "talk", "Let care for the room become care for its people", [0]),
        objective("Study the Word of Wisdom in its 1833 setting", "center", "inspect", "Receive counsel without scoring other people's worth", [3], "light"),
        objective("Ask Orson about learning and the heavens", "prayer", "talk", "Make room for an honest question", [2], "stars"),
    ]),
    "17": ("kirtland", [
        objective("Receive the letter from Jackson County", "study", "inspect", "Read the report with the household", [1]),
        objective("Listen to a displaced family", "gather", "talk", "Hear the needs behind the news", [0]),
        objective("Set aside relief supplies", "center", "serve", "Prepare food and shelter for those driven out", [2], "comfort"),
    ]),
    "18": ("missouri", [
        objective("Share provisions on the road", "gather", "serve", "Give attention to the families and travelers", [1]),
        objective("Help repair the wagon", "study", "serve", "Join Heber at the damaged wheel", [0]),
        objective("Sit beside the ill", "center", "serve", "Remain with a companion through disappointment", [2], "comfort"),
        objective("Choose restraint and continued service", "prayer", "pray", "Seek a faithful response without a battle victory", [extra("JOSEPH_YOUNG", "We have come a long way. Let us not forget the people we came to help.")], "light"),
    ]),
    "19": ("kirtland", [
        objective("Convene the ministry council", "center", "speak", "Listen as the Twelve prepare to serve", [0]),
        objective("Prepare a missionary departure", "gather", "serve", "Arrange what the travelers need", [extra("BRIGHAM", "Then we begin with what is in front of us: the road, the families, and the work.")]),
        objective("Study scripture and the heavens", "study", "inspect", "Consider the papyri and learning with humility", [1, 2], "stars"),
    ]),
    "20": ("kirtland", [
        objective("Finish the temple for the gathering", "gather", "serve", "Carry the final work into shared worship", [extra("EMMA", "There are families waiting outside. Let us make a place for them.")]),
        objective("Join the dedication · March 27, 1836", "center", "pray", "Offer the work to God", [extra("JOSEPH_MATURE", "May this house be a place of learning, service, and prayer.")], "light"),
        objective("Recognize Elijah Able's ministry · March 31", "gather", "talk", "Hear Elijah speak about the responsibility of ministry", [extra("ELIJAH_ABLE", "A calling asks something of the whole person. I want to carry it with care, among people who will have questions of their own."), extra("JOSEPH_MATURE", "Let us hear those questions, and make room for the work you have to do.")], "comfort", "Dated reconstruction around Able's March 31, 1836 elder's license. Ambrose Palmer ordained him an elder; this is not Joseph performing that ordination."),
        objective("Read the elder's license together", "study", "inspect", "Examine the date, office and institutional recognition", [extra("ELIJAH_ABLE", "A license is a beginning. It does not listen to a troubled person for me. That is work I must learn to do."), extra("JOSEPH_MATURE", "Then let this record be joined to the care we give each other.")], "light", "The surviving copied license names Joseph Smith Jr. as chairman. Its exact handover, blocking and conversation are original dramatization."),
        objective("Prepare room for a ministry", "center", "serve", "Set aside a book and practical provisions", [extra("ELIJAH_ABLE", "I mean to listen as carefully as I speak. A person must not disappear behind the question we hope to answer.")], "comfort"),
        objective("Part as fellow workers", "gather", "talk", "Let Elijah carry the final thought before the next dated scene", [extra("ELIJAH_ABLE", "There is much to learn. I am ready to begin with the people before me.")], "comfort"),
        objective("Return with Oliver · April 3, 1836", "prayer", "pray", "Pray beyond the curtain on the separate April date", [0], "revelation"),
        objective("Receive the heavenly visitors", "study", "listen", "Hear Christ, Moses, Elias, and Elijah in turn", [1, 2, 3, 4], "light"),
    ]),
    "21": ("kirtland", [
        objective("Hear the depositors", "gather", "talk", "Give full attention to a household's losses", [0]),
        objective("Examine the needs with Whitney", "study", "inspect", "Face the limits of the available provisions", [2]),
        objective("Help a household before leaving", "center", "serve", "Offer practical help without promising to undo history", [1], "comfort"),
    ]),
    "22": ("missouri", [
        objective("Hear the gathering's hopeful plans", "center", "talk", "Begin with the families at Far West", [extra("HYRUM", "There are homes to prepare and families still on the road.")]),
        objective("Receive the news from Hawn's Mill", "study", "listen", "Hear a survivor's report, not a scene Joseph witnessed", [1]),
        objective("Help a family prepare to leave", "gather", "serve", "Distribute supplies and keep the road clear", [2], "comfort"),
        objective("Submit during the Far West collapse", "journey", "travel", "Stay with Hyrum rather than pursue retaliation", [0, 3]),
    ]),
    "23": ("liberty", [
        objective("Share the cold room with Hyrum", "gather", "serve", "Offer a place beside you and share the provisions", [1]),
        objective("Receive Emma's news", "study", "talk", "Hear about the families beyond the prison walls", [2]),
        objective("Pray from the confinement", "prayer", "pray", "Bring anguish honestly before God", [0], "light"),
        objective("Continue the letter in hope", "center", "speak", "Write of persuasion, patience, and love", [3], "comfort"),
    ]),
    "24": ("nauvoo", [
        objective("Begin a home beside the river", "center", "serve", "Help turn the unsettled ground into shelter", [0]),
        objective("Visit the sick with Newel Knight", "gather", "serve", "Enter with compassion and offer a blessing", [3, 4], "comfort"),
        objective("Seek redress · Washington, 1839", "study", "speak", "Present the Saints' petition and hear the refusal", [2, 1], None, "A separate dated Washington encounter is represented through its petition and reply; Joseph returns to Nauvoo afterward."),
        objective("Return to Nauvoo and the temple work", "prayer", "serve", "Set a stone for a gathering that remembers the dead", [extra("JOSEPH_MATURE", "Let us build with room in our hearts for those who have gone before us.")], "light"),
    ]),
    "25": ("nauvoo", [
        objective("Enter the Red Brick Store · March 15", "gather", "talk", "Greet Abraham Jonas at the lodge gathering", [0]),
        objective("Attend to the fraternal instruction", "study", "inspect", "Consider its public symbols of moral responsibility", [1]),
        objective("Return for advancement · March 16", "center", "listen", "Mark the separate next day before continuing", [2], "light", "Initiation was March 15, 1842; Fellow Craft and Master Mason advancement followed March 16. This is not a single-day initiation."),
    ]),
    "26": ("nauvoo", [
        objective("Prepare the Relief Society meeting", "study", "serve", "Set the minutes and make room for the members", [0]),
        objective("Listen as Emma and her counselors organize", "center", "listen", "Hear their priorities for relief", [1, 2, 3], "comfort"),
        objective("Prepare for covenant and family teachings", "prayer", "inspect", "Consider responsibility toward living and dead", [extra("JOSEPH_MATURE", "Let our promises be joined to the care we offer in our own homes.")], "light"),
        objective("Hear Emma in private", "gather", "talk", "Acknowledge the pain of plural marriage without inventing assent", [4, 5]),
        objective("Make room for Jane Manning · fall 1843", "gather", "serve", "Open a place in the household for Jane and her family", [extra("JANE_MANNING", "We have come a long way. Before I put down this bundle, I would like to tell you who has come with me."), extra("EMMA", "Come in. We can begin by hearing you.")], "comfort", "A separately dated fall 1843 arrival, informed by Jane's later autobiography. Jane was not yet married to Isaac James. This adapted conversation is not a verbatim transcript."),
        objective("Hear the journey in Jane's own voice", "study", "talk", "Give Jane time without interrupting her account", [extra("JANE_MANNING", "There were doors that did not open to us. We kept on together. I want that part remembered, too—not only the moment we arrived."), extra("JOSEPH_MATURE", "Tell us what you wish us to hear. We will stay and listen.")], "comfort"),
        objective("Let welcome become friendship", "center", "talk", "Ask what a place of belonging should make possible", [extra("JANE_MANNING", "I have work to do and things to learn. I hope a home can make room for both."), extra("EMMA", "Then we should hear your hopes as well as your needs.")], "light", "Jane has spiritual and personal agency. Hospitality is not conditional on service or endorsement, and this scene does not assert that racism was absent."),
    ]),
    "27": ("nauvoo", [
        objective("Examine the candidates' replies · January 1844", "study", "inspect", "Compare promises with the protection the Saints have sought", [extra("SIDNEY", "A promise of fairness must answer the question we have actually asked: what protection will be given when a people is driven from its home?"), extra("JOSEPH_MATURE", "We must put that question plainly before the country.")], None, "Candidates' correspondence supplies the historical context. This discussion is adapted; no face-to-face debate with Clay or Van Buren is invented."),
        objective("Commit to the campaign · January 29", "center", "speak", "Accept the public responsibility without an invented victory", [3], "light"),
        objective("Work with Phelps on the platform · February", "study", "talk", "Read the national emancipation and reform proposals", [extra("WW_PHELPS", "The country must be able to read what you propose—not merely what your opponents suppose you propose."), extra("JOSEPH_MATURE", "Then let us be clear about freedom, public protection, and the duty of government.")], None, "Joseph's 1844 platform proposed compensated emancipation by 1850. Compensation would go to enslavers, not the formerly enslaved. The dialogue is an adaptation, not a quotation."),
        objective("Proof the printer's copy", "study", "inspect", "Attend to the words before they go into type", [0, extra("WW_PHELPS", "A promise must survive being printed. Let us attend to every line.")]),
        objective("Make space at the press", "gather", "serve", "Prepare paper and gather the finished pamphlets", [extra("WILLIAM_CLAYTON", "These sheets will travel farther than any one of us can. Keep the copies together and the words legible.")]),
        objective("Hear questions of conscience", "gather", "talk", "Listen to disagreement about rights and responsibility", [1, extra("TOWNSPERSON", "How will a government protect a minority without simply asking the majority to be kinder?"), extra("JOSEPH_MATURE", "The protection we ask for must become a public obligation, not a favor withdrawn when it is inconvenient.")]),
        objective("Address the early campaign gathering", "center", "speak", "Speak for religious liberty and protection under law", [3, extra("JOSEPH_MATURE", "A people's safety should not depend on whether its neighbors approve its worship.")], "light", "The later electioneer departure, convention and Polk nomination follow the April 7 discourse in the next chapter. This early gathering does not compress all of 1844 into January."),
    ]),
    "28": ("nauvoo", [
        objective("Listen to Louisa Follett", "gather", "talk", "Let the family's grief come before the public address", [0, 1], "comfort"),
        objective("Step to the stand and seek God's guidance", "center", "pray", "Hold to ask for understanding before speaking", [2], "light"),
        objective("Console the gathered mourners", "center", "speak", "Speak gently to a grieving household", [3, 4, 5, 6]),
        objective("Teach divine life and eternal intelligence", "prayer", "speak", "Deliver the adapted discourse with room to pause", [7, 8, 9, 10, 11, 12], "stars", "This is an original adaptation based on surviving reports, not a verbatim transcript of the King Follett discourse."),
        objective("Return the teaching to a person", "gather", "talk", "Carry hope to the mourner and compare the recorders' notes", [13, 14, 15, 16, 17], "comfort"),
        objective("Prepare the electioneers · April 9 onward", "study", "serve", "After the discourse, prepare travel packets and a route", [extra("BRIGHAM", "The road will take us among people who know little of this place. Let us carry clear words and listen to the people we meet."), extra("WW_PHELPS", "The pamphlets are ready. Each bundle needs a destination.")], None, "A separate dated campaign continuation after April 7, not part of the King Follett sermon. Individual departure details are condensed."),
        objective("Consider Clay's reply · May 13", "study", "inspect", "Compare a national candidate's answer with Joseph's public response", [extra("JOSEPH_MATURE", "We have asked what protection would be offered to us. A candidate's answer deserves careful reading, and our own answer must be made in public.")], None, "Joseph's May 13 letter to Henry Clay is documented. No Clay actor appears as if he visited this Nauvoo meeting."),
        objective("Address the convention · May 17", "center", "speak", "Stand before the gathering without changing the election's outcome", [extra("JOSEPH_MATURE", "Let the promises of this republic reach the people who have had least reason to trust them."), extra("SIDNEY", "Then the work is to carry that argument beyond this gathering.")], "light", "Adapted convention speech, not a verbatim transcript. Joseph remains a candidate; the player does not win the presidency."),
        objective("Read the Polk nomination news · late May / June", "study", "inspect", "Understand the changed Democratic contest and the limits of fraternity", [extra("WW_PHELPS", "The Democrats have nominated James K. Polk. The contest has changed, and these reports must be read with care."), extra("JOSEPH_MATURE", "Let us judge proposals and the treatment of people. A fraternal bond does not answer every question of public duty.")], None, "Polk was nominated May 29, 1844, not at Joseph's January declaration. His Masonic affiliation is context, not evidence of a secret party conspiracy or a private Joseph–Polk meeting."),
    ]),
    "29": ("nauvoo", [
        objective("Hear the civic dispute", "study", "inspect", "Read the criticism and acknowledge its questions", [0]),
        objective("Say goodbye to Emma and the children", "gather", "talk", "Take time for an ordinary family parting", [1, 2], "comfort"),
        objective("Take the road with Hyrum", "journey", "travel", "Carry the documents toward Carthage", [3]),
        objective("Hear the governor's assurance", "center", "listen", "Submit to the legal process without a promised escape", [4]),
    ]),
    "30": ("carthage", [
        objective("Listen to John Taylor", "study", "listen", "Receive the offer of a comforting hymn", [0, 1], "comfort", "The hymn is not synthesized here; a reviewed sung recording can be supplied through the audio manifest."),
        objective("Entrust a message to Dan Jones", "gather", "talk", "Send words of care before his departure", [2]),
        objective("Remain beside your companions", "center", "serve", "Reach toward Hyrum and Willard in the final hour", [3, 4], "light", "The attack is conveyed without graphic violence. Joseph and Hyrum die on June 27, 1844. This is not the end of the playable story."),
    ]),
    "31": ("celestial", [
        objective("Recognize your brother beyond the veil", "gather", "talk", "Find Hyrum beside the water", [0, 1], "comfort"),
        objective("Meet Alvin in the imagined garden", "study", "talk", "Receive a reunion envisioned in hope", [2]),
        objective("Welcome someone still alone", "center", "serve", "Follow Christ's invitation to continued service", [3], "light"),
        objective("Prepare the garden for another arrival", "prayer", "serve", "Make room rather than seek a throne", [extra("JOSEPH_MATURE", "There is work here that begins with a welcome.")], "stars"),
    ]),
    "32": ("celestial", [
        objective("Receive a world as a stewardship", "prayer", "listen", "Hear Christ's imagined commission of love", [0], "stars", "A fictional vision of future resurrection, eternal growth, and creative stewardship; not an official teaching that every person is given a private planet."),
        objective("Open a spring for the garden", "study", "serve", "Bring water to a living place", [1], "light"),
        objective("Prepare a home for free inhabitants", "center", "serve", "Make a place without demanding obedience", [2], "comfort"),
        objective("Offer another person a hand", "gather", "serve", "Complete the journey with the kindness that began it", [3], "stars"),
    ]),
}

ACTORS = {
    "01": [actor("JOSEPH_SR", [-5.5, 0, 1]), actor("LUCY", [4.5, 0, -2])],
    "02": [actor("METHODIST", [-5.5, 0, 1]), actor("PRESBYTERIAN", [4.5, 0, -2]), actor("BAPTIST", [8.5, 0, -3])],
    "03": [actor("FATHER", [-1.8, 0, -2], 2, height=2.2), actor("CHRIST", [1.8, 0, -2], 2, height=2.1)],
    "04": [actor("MORONI", [1.5, 0, -1.5], 1, 2), actor("JOSEPH_SR", [-5.5, 0, 1], 3)],
    "05": [actor("MORONI", [1.5, 0, -2], 0, 1), actor("ALVIN", [-5.5, 0, 1], 2, 2), actor("LUCY", [4.5, 0, -2], 3)],
    "06": [actor("ISAAC_HALE", [-5.5, 0, 1], 0, 0), actor("EMMA", [4.5, 0, -2], 1), actor("MORONI", [1.5, 0, -2], 2, 2)],
    "07": [actor("EMMA", [1.8, 0, -1.5]), actor("MARTIN", [-5.5, 0, 1], 1)],
    "08": [actor("OLIVER", [-5.5, 0, 1]), actor("EMMA", [4.5, 0, -2]), actor("DAVID", [-2, 0, 11], 6), actor("PETER_WHITMER", [2, 0, 11], 6)],
    "09": [actor("OLIVER", [-4.5, 0, 0]), actor("JOHN_BAPTIST", [1.5, 0, -2], 1, 2), actor("PETER", [1.5, 0, -3], 3), actor("JAMES", [3.3, 0, -3], 3), actor("JOHN", [5.1, 0, -3], 3)],
    "10": [actor("OLIVER", [-3, 0, -3], 0, 1), actor("DAVID", [0, 0, -3], 0, 1), actor("MARTIN", [3, 0, -3], 0, 1), actor("MORONI", [0, 0, -6.5], 1, 1), actor("GRANDIN", [4.5, 0, -2], 4)],
    "11": [actor("EMMA", [4.5, 0, -2]), actor("OLIVER", [-2, 0, -2]), actor("PETER_WHITMER", [-5.5, 0, 1]), actor("NEWEL_KNIGHT", [1.5, 0, -5])],
    "12": [actor("EMMA", [0, 0, -2]), actor("WHITNEY", [-5.5, 0, 1]), actor("ELIZABETH_WHITNEY", [4.5, 0, -2]), actor("SIDNEY", [2, 0, -2])],
    "13": [actor("SIDNEY", [1.5, 0, -5]), actor("EDWARD_PARTRIDGE", [4.5, 0, -2])],
    "14": [actor("SIDNEY", [4.5, 0, -2]), actor("CHRIST", [1.5, 0, -4], 2)],
    "15": [actor("EMMA", [4.5, 0, -2]), actor("JOHN_JOHNSON", [-5.5, 0, 1]), actor("SIDNEY", [1.5, 0, -2])],
    "16": [actor("WHITNEY", [4.5, 0, -2]), actor("EMMA", [-5.5, 0, 1]), actor("SIDNEY", [1.5, 0, -2]), actor("ORSON", [1.5, 0, -5])],
    "17": [actor("EMMA", [4.5, 0, -2]), actor("REFUGEE", [-5.5, 0, 1]), actor("EDWARD_PARTRIDGE", [1.5, 0, -2])],
    "18": [actor("BRIGHAM", [-5.5, 0, 1]), actor("HEBER", [4.5, 0, -2]), actor("REFUGEE", [1.5, 0, -2]), actor("ORSON", [2, 0, -5])],
    "19": [actor("OLIVER", [1.5, 0, -2]), actor("BRIGHAM", [-5.5, 0, 1]), actor("HEBER", [-4, 0, -2]), actor("ORSON", [4.5, 0, -2])],
    "20": [actor("OLIVER", [-2, 0, -5]), actor("EMMA", [-5.5, 0, 1], 0, 1), actor("ELIJAH_ABLE", [-5.5, 0, 1], 2, 5), actor("CHRIST", [1.5, 0, -3], 7), actor("MOSES", [-3, 0, -3], 7), actor("ELIAS", [3, 0, -3], 7), actor("ELIJAH", [5, 0, -3], 7)],
    "21": [actor("DEPOSITOR", [-5.5, 0, 1]), actor("WHITNEY", [4.5, 0, -2]), actor("EMMA", [1.5, 0, -2])],
    "22": [actor("HYRUM", [1.5, 0, -2]), actor("SIDNEY", [4.5, 0, -2]), actor("REFUGEE", [-5.5, 0, 1]), actor("OFFICER", [2, 0, 11], 3)],
    "23": [actor("HYRUM", [-5.5, 0, 1]), actor("EMMA", [4.5, 0, -2], 1, 1)],
    "24": [actor("EMMA", [1.5, 0, -2]), actor("NEWEL_KNIGHT", [-5.5, 0, 1], 1), actor("VAN_BUREN", [4.5, 0, -2], 2, 2), actor("BRIGHAM", [2, 0, -5], 3)],
    "25": [actor("JONAS", [-5.5, 0, 1]), actor("SIDNEY", [4.5, 0, -2])],
    "26": [actor("EMMA", [-5.5, 0, 1]), actor("ELIZA", [4.5, 0, -2], 0, 2), actor("SARAH_CLEVELAND", [-2, 0, -2], 0, 2), actor("ELIZABETH_WHITNEY", [2, 0, -2], 0, 2), actor("JANE_MANNING", [4.5, 0, -2], 4)],
    "27": [actor("WILLIAM_CLAYTON", [4.5, 0, -2]), actor("SIDNEY", [-5.5, 0, 1]), actor("WW_PHELPS", [-3, 0, -1], 2), actor("HYRUM", [2, 0, -2]), actor("TOWNSPERSON", [-6, 0, 2], 5)],
    "28": [actor("LOUISA", [-5.5, 0, 1], 0, 4), actor("MOURNER", [-3.8, 0, 2.5], 0, 4), actor("WILLARD", [4.5, 0, -2], 0, 4), actor("WILFORD", [6, 0, -2], 0, 4), actor("THOMAS_BULLOCK", [5, 0, 0], 0, 4), actor("WW_PHELPS", [4.5, 0, -2], 5), actor("BRIGHAM", [-5.5, 0, 1], 5), actor("SIDNEY", [2, 0, -2], 5)],
    "29": [actor("WILLIAM_LAW", [4.5, 0, -2], 0, 0), actor("EMMA", [-5.5, 0, 1], 0, 1), actor("CHILD", [-4.5, 0, 2], 0, 1, 1.1), actor("HYRUM", [-1.5, 0, 11], 2), actor("FORD", [1.5, 0, -2], 3)],
    "30": [actor("JOHN_TAYLOR", [4.5, 0, -2]), actor("DAN_JONES", [-5.5, 0, 1], 0, 1), actor("HYRUM", [-1.8, 0, -2]), actor("WILLARD", [1.8, 0, -2])],
    "31": [actor("HYRUM", [-5.5, 0, 1]), actor("ALVIN", [4.5, 0, -2]), actor("CHRIST", [1.5, 0, -2], 2)],
    "32": [actor("CHRIST", [1.5, 0, -5]), actor("FUTURE_GUIDE", [1.5, 0, -2]), actor("MOURNER", [-5.5, 0, 1], 3)],
}

WITNESSES = ["CHRISTIAN_WHITMER", "JACOB_WHITMER", "PETER_WHITMER_JR", "JOHN_WHITMER", "HIRAM_PAGE", "JOSEPH_SR", "HYRUM", "SAMUEL_SMITH"]
WITNESS_POSITIONS = [[-4.8, 0, -1.6], [-3.3, 0, -3.1], [-1.5, 0, -3.7], [0.5, 0, -3.7], [2.5, 0, -3.1], [4.2, 0, -1.6], [4.2, 0, 1], [-4.8, 0, 1]]
ACTORS["10"] += [actor(identity, position, 2, 3) for identity, position in zip(WITNESSES, WITNESS_POSITIONS)]
USED_RECORDING_IDS = set()


def make_lines(scene_id, scripts, objective_index):
    result = []
    for line_index, item in enumerate(scripts):
        if isinstance(item, int):
            speaker, text, direction = dialogue[scene_id][item]
            line_id = f"JS_{scene_id}_{speaker}_{item + 1:03d}"
            if line_id in USED_RECORDING_IDS:
                line_id += f"_AT_{objective_index + 1:02d}_{line_index + 1:02d}"
            result.append({"speaker": speaker, "text": text, "direction": direction, "lineId": line_id})
        else:
            result.append({**item, "lineId": f"GAME_{scene_id}_{objective_index + 1:02d}_{line_index + 1:02d}"})
        USED_RECORDING_IDS.add(result[-1]["lineId"])
    return result


def make_chapter(source, plan, actors):
    environment, objectives = plan
    numeric_id = int(source["id"]) if source["id"].isdigit() else None
    chapter = {
        **{key: source[key] for key in ("id", "title", "date", "place", "status", "history", "minutes")},
        "environment": environment,
        "playerId": source.get("playerId") or ("JOSEPH_CHILD" if numeric_id == 1 else "JOSEPH_YOUTH" if numeric_id and numeric_id <= 5 else "JOSEPH_YOUNG" if numeric_id and numeric_id < 20 else "JOSEPH_MATURE"),
        "intro": source["experience"],
        "epilogue": source["payoff"],
        "sourceUrls": [{"title": sources[key]["title"], "url": sources[key]["url"]} for key in source["sources"] if key in sources],
        "actors": actors,
        "objectives": [],
        "speculative": bool(numeric_id and numeric_id >= 31),
    }
    for key in ["documentary", "perspective", "locationProfile"]:
        if key in source:
            chapter[key] = source[key]
    migrations = {"08": [0, 2, 4, 6], "20": [0, 1, 6, 7], "27": [2, 5, 6]}
    if source["id"] in migrations:
        chapter["objectiveMigrationV1"] = migrations[source["id"]]
    for index, item in enumerate(objectives):
        chapter["objectives"].append({**{key: value for key, value in item.items() if key != "script"}, "id": f"{source['id']}-{index + 1}", "lines": make_lines(source["id"], item["script"], index)})
    return chapter


chapters = [make_chapter(source, PLANS[source["id"]], ACTORS[source["id"]]) for source in campaign["scenes"]]

DOCUMENTARY_SCENES = [
    ({
        "id": "N1", "title": "Great buildings, an open conversation", "date": "October 1832",
        "place": "Lower Manhattan, New York City · Pearl Street House and streets",
        "status": "Historical visit and letter; surroundings and private conversation dramatized",
        "history": "Joseph's October 13, 1832 letter to Emma describes New York buildings and useful inventions, his longing for home, and a sustained religious conversation with a young man. The precise route, room arrangement and words of that conversation are not fixed by the letter. This is not an attested soapbox sermon or a modern transhumanist manifesto.",
        "experience": "Walk a crowded commercial street with Whitney, consider useful inventions, return to the boarding house, listen before discussing faith, and write home. The city is an inhabited alternative to a frontier stereotype.",
        "payoff": "Wonder at human ingenuity returns to concern for a person and a family.",
        "minutes": 15, "sources": ["manhattan_letter"], "playerId": "JOSEPH_YOUNG", "documentary": True,
        "perspective": "Joseph's documented 1832 visit; adapted dialogue, not a verbatim street sermon",
    }, ("manhattan", [
        objective("Walk the commercial city · October 1832", "journey", "travel", "Look along the busy street before returning to the boarding house", [extra("WHITNEY", "There is much to arrange before we return west. Let us keep the goods and the journey in order.")], None, "The streets evoke lower Manhattan; the precise walking route is interpretive, not a surveyed reconstruction."),
        objective("Consider buildings and useful inventions", "study", "inspect", "Look at the city as a place of human ingenuity", [extra("JOSEPH_YOUNG", "If these works make people more comfortable, wiser, and happier, there is good in that labor. Let us not forget the people within these walls.")], "light", "Original paraphrase of the October 13 letter's reflection on useful inventions, not a historical quotation or modern transhumanist terminology."),
        objective("Listen before teaching", "gather", "talk", "Hear a traveler's concern about illness and purpose", [extra("TOWNSPERSON", "After coming so near to death, I find myself asking what I ought to do with the life still before me."), extra("JOSEPH_YOUNG", "Then let us begin with that question, and take the time it deserves.")], "comfort", "The letter reports a conversation with a young man recovering from cholera. His words, appearance and exact setting here are dramatized."),
        objective("Return to the room and write to Emma", "center", "inspect", "Let the sight of the city return your thoughts to home", [extra("JOSEPH_YOUNG", "There is much here to see, yet my thoughts return to you and the children. I will write before the day is done.")], "comfort"),
    ]), [actor("WHITNEY", [4.5, 0, -2]), actor("TOWNSPERSON", [-5.5, 0, 1], 2, 2)], "15"),
    ({
        "id": "B1", "title": "Walker Lewis: a room for a great question", "date": "Circa 1843–1844 · parallel documentary vignette",
        "place": "Lowell, Massachusetts · interpretive barbershop and mill-town street",
        "status": "Documentary perspective outside Joseph's travels; original reflective dialogue",
        "history": "Walker Lewis was a Massachusetts barber, abolitionist, Black fraternal leader and Latter-day Saint elder. William Smith ordained him around 1843 or 1844. His direct meeting with Joseph is not established here. The shop layout, daily tasks and reflective speech are interpretive, not recovered evidence of a specific day.",
        "experience": "The viewpoint changes explicitly to Walker for a parallel documentary vignette. Open the shop, prepare tools, make room for study, examine abolition and ministry records, and return to the street. This is not Joseph visiting Lowell or an invented endorsement of Joseph's campaign.",
        "payoff": "Religious fellowship and civic freedom become daily work in a community with its own center.",
        "minutes": 18, "sources": ["walker_lewis"], "playerId": "WALKER_LEWIS", "documentary": True,
        "perspective": "You now view a documentary dramatization through Walker Lewis, not a memory or visit by Joseph Smith. All spoken reflections are original adaptations.",
    }, ("lowell", [
        objective("Open Walker's working place", "center", "serve", "Enter from the street and prepare the room", [extra("WALKER_LEWIS", "A day's work begins with making a place ready. People bring more through a door than what first meets the eye.")]),
        objective("Arrange the tools with care", "study", "inspect", "Attend to the basin, cloth and working chair", [extra("WALKER_LEWIS", "A person should be able to rest here a moment, and be treated with care.")], "comfort"),
        objective("Make room for a great question", "gather", "inspect", "Set study beside skilled daily work", [extra("WALKER_LEWIS", "A room can be small and still make space for a great question.")], "light"),
        objective("Consider freedom in daily practice", "study", "inspect", "Read the documentary account of Black abolitionist and fraternal organizing", [extra("WALKER_LEWIS", "Freedom must be more than a fine word. It must change what we permit one another to do.")], None, "Lewis's abolitionist organizing and Black Masonic leadership are documented; this reflection is dramatized, not an archival quotation. No campaign endorsement is asserted."),
        objective("Consider the responsibilities of ministry", "prayer", "pray", "Read the evidence for an elder's calling and reflect", [extra("WALKER_LEWIS", "Let the care I offer in this place be joined to the faith I carry beyond it.")], "light", "William Smith's elder ordination of Lewis is approximately dated 1843 or 1844. This is not Joseph ordaining him or a reconstructed word-for-word ritual."),
        objective("Return to the open street", "journey", "travel", "Leave the door open to work, learning and community", [extra("WALKER_LEWIS", "There is work still to do. Let the door remain open.")], "comfort"),
    ]), [], "26"),
]

for source, plan, actors, after_id in DOCUMENTARY_SCENES:
    insertion = next(index for index, chapter in enumerate(chapters) if chapter["id"] == after_id) + 1
    chapters.insert(insertion, make_chapter(source, plan, actors))

ERA_PLANS = [
    ("E1", "The garden before the years", "An imagined Eden", "grove", "FUTURE_GUIDE", "Care for a garden before crossing the years", "Plant a place of welcome", "Enter the mission's first bubble portal"),
    ("E2", "Questions in the nineteenth century", "Salt Lake City after 1847 · fictional reflection", "kirtland", "BRIGHAM", "Hear Brigham reflect on Joseph's unfinished work", "Read with Orson without mistaking speculation for doctrine", "Carry humility to the next crossing"),
    ("E3", "A doorstep in 1955", "1955 · speculative time mission", "town", "MISSIONARY_1955", "Meet Ruth before the missionary visit", "Offer useful help without demanding belief", "Leave the household free to decide"),
    ("E4", "The family archive", "1994 · speculative time mission", "harmony", "ARCHIVIST_1994", "Ask Daniel about the neglected family recording", "Listen to the person behind the archive", "Preserve a memory with permission"),
    ("E5", "The shared water", "2026 · speculative time mission", "nauvoo", "CARETAKER_2026", "Ask Ada what the garden needs", "Share water fairly among the households", "Open the crossing without deciding another's life"),
    ("E6", "The desert after the fire", "An imagined nuclear aftermath", "missouri", "SURVIVOR", "Hear Mara's practical request", "Repair the well before promising paradise", "Offer shelter without claiming control"),
    ("E7", "The closed archive", "An imagined future of guarded knowledge", "liberty", "ARCHIVE_KEEPER", "Hear the custodian's fear of an open future", "Ask whose freedom the closed archive has taken", "Restore the record to the people"),
    ("E8", "Zion is a welcome", "An imagined open future", "celestial", "FUTURE_GUIDE", "See the city as unfinished shared work", "Open the garden to another free arrival", "Continue the mission in love"),
]

for scene_id, title, date, environment, identity, first, second, third in ERA_PLANS:
    scene_lines = dialogue[scene_id]
    objectives = [
        objective(first, "gather", "talk", "Listen to the person in this era", [0]),
        objective(second, "study", "serve", "Join the practical work before you", [1] if len(scene_lines) > 1 else [], "comfort"),
        objective(third, "prayer", "travel", "Approach the bubble crossing with an open hand", [2] if len(scene_lines) > 2 else [extra("JOSEPH_MATURE", "Let the next crossing begin with care for those we meet.")], "stars"),
    ]
    expansion_actors = [actor(identity, [-5.5, 0, 1])]
    if identity != "FUTURE_GUIDE":
        expansion_actors.append(actor("FUTURE_GUIDE", [1.5, 0, -5]))
    if scene_id == "E2":
        expansion_actors.append(actor("ORSON", [4.5, 0, -2]))
    if scene_id == "E5":
        expansion_actors.append(actor("FUTURE_SCIENTIST", [4.5, 0, -2]))
    if scene_id == "E8":
        expansion_actors.append(actor("CHRIST", [4.5, 0, -2]))
    chapters.append({
        "id": scene_id, "title": title, "date": date, "place": "One fictional mission landscape across changing eras",
        "environment": environment, "playerId": "JOSEPH_MATURE", "status": "Explicit speculative religious science fiction; not a historical episode or official doctrine",
        "history": "An optional imagined mission of free people across time, inspired by Zion, eternal progression, and independent transhumanist ideas. Joseph appears here as a fictional postmortal traveler, never as a claim that he lived through these earthly dates.",
        "intro": "Cross the bubble thresholds as a servant, not a conqueror. Each era asks for one concrete act of care before the next crossing opens.",
        "epilogue": "The future is worthy of Zion only if the people within it remain free.",
        "minutes": 8, "actors": expansion_actors, "sourceUrls": [{"title": sources["xchurch"]["title"] + " · independent inspiration, not official Church doctrine", "url": sources["xchurch"]["url"]}], "expansion": True, "speculative": True,
        "objectives": [{**{key: value for key, value in item.items() if key != "script"}, "id": f"{scene_id}-{index + 1}", "lines": make_lines(scene_id, item["script"], index)} for index, item in enumerate(objectives)],
    })

record_chapters = build_record_chapters()
chapters.extend(record_chapters)

assert [chapter["id"] for chapter in chapters if chapter["id"].isdigit()] == [f"{index:02d}" for index in range(1, 33)]
for chapter in chapters:
    assert chapter["objectives"]
    assert len({person["id"] for person in chapter["actors"]}) == len(chapter["actors"]), chapter["id"]
    for item in chapter["objectives"]:
        assert item["lines"], f"Missing dialogue for {item['id']}"
        assert all(line["speaker"] in names for line in item["lines"]), item["id"]
        assert len(item["target"]) == 3
        assert max(abs(value) for value in item["target"]) <= 20

witness_chapter = next(chapter for chapter in chapters if chapter["id"] == "10")
assert len([person for person in witness_chapter["actors"] if person["id"] in WITNESSES]) == 8
assert next(person for person in witness_chapter["actors"] if person["id"] == "MORONI")["hideAfter"] < 2
assert all(next(person for person in witness_chapter["actors"] if person["id"] == identity)["showFrom"] == 2 for identity in WITNESSES)

OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / "chapters.json").write_text(json.dumps({"title": campaign["working_title"], "version": 2, "coreCount": 32, "documentaryCount": len(DOCUMENTARY_SCENES), "recordCount": len(record_chapters), "recordCast": RECORD_CAST, "names": names, "chapters": chapters}, indent=2) + "\n")
print(f"Built {len(chapters)} chapters and {sum(len(chapter['objectives']) for chapter in chapters)} playable objectives.")
