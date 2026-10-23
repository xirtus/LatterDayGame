import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPANSION = json.loads((ROOT / "docs/book-of-mormon-expansion.json").read_text())
CAST = EXPANSION["cast"] + [
    {"id": "ENOS", "name": "Enos", "voice": "A reflective adult whose prayer grows from private anguish into care for others; unhurried, intimate and grounded."},
    {"id": "ANGEL_BOM", "name": "The angel in Alma's account", "voice": "Clear and arresting warning without anger, monster effects or an imitation of Christ's approved voice."},
]


PLANS = {
    "BM01": ("jerusalem", "NEPHI", ["LEHI_PATRIARCH", "SARIAH", "SAM"], "household-departure", [
        ("Hear the warning at home", "talk", "SARIAH", "If we are to leave, we must think of the children, the water, and the road. Let us prepare together."),
        ("Prepare the household supplies", "serve", "NEPHI", "I will carry what I can. We cannot bring the whole house, but we can take care of one another.", ("collect", 3, "Gather water, food and bedding")),
        ("Follow the road into the wilderness", "travel", "LEHI_PATRIARCH", "We leave our familiar walls behind. Stay near one another as we go.", ("navigate", 3, "Follow the departure route")),
        ("Read the later account of Jerusalem", "inspect", "NEPHI", "We had already departed when destruction came to the city. The record asks us to remember those who remained."),
    ]),
    "BM02": ("dream", "LEHI_PATRIARCH", ["SARIAH", "NEPHI", "SAM"], "rail-and-sound-navigation", [
        ("Pray in the uncertain wilderness", "pray", "LEHI_PATRIARCH", "Lord, have mercy on me. I cannot find my way by my own sight alone."),
        ("Follow the iron rod through the mist", "travel", "LEHI_PATRIARCH", "There is something firm beside the path. I will keep hold as the mist closes around me.", ("navigate", 4, "Follow the rail landmarks")),
        ("Receive the fruit of the tree", "listen", "LEHI_PATRIARCH", "Such joy! I desire that my family should partake also. This is not something I want to keep for myself."),
        ("Call to your family", "speak", "SARIAH", "We hear you. Show us the way to where you stand."),
    ]),
    "BM03": ("jerusalem", "NEPHI", ["ZORAM", "SAM"], "night-observation", [
        ("Remember the earlier attempts", "inspect", "NEPHI", "We have tried and failed. I do not know beforehand what I will do, but I will go forward with care."),
        ("Observe a quiet approach", "travel", "NEPHI", "I must watch the streets and listen before I move. A reckless step could endanger those waiting for me.", ("observe", 3, "Observe the treasury approaches")),
        ("Attend to Nephi's difficult account", "listen", "NEPHI", "I shrank from what was asked of me. The record tells this night with its terrible weight, not as a thing to celebrate."),
        ("Hear Zoram's decision", "talk", "ZORAM", "You have given me your word. I will go with you, and I will make this choice my own."),
    ]),
    "BM04": ("shipyard", "NEPHI", ["SARIAH", "LAMAN", "LEMUEL", "SAM"], "shipyard-work", [
        ("Make a working camp at Bountiful", "serve", "SARIAH", "The sea is before us, but today we still need water, shade, and a place for the family to rest.", ("arrange", 3, "Prepare the shore camp")),
        ("Gather materials and prepare tools", "serve", "NEPHI", "Let us begin with the tools and the timber. The work before us will take more than one pair of hands.", ("collect", 4, "Gather shipbuilding materials")),
        ("Listen through the disagreement", "talk", "LAMAN", "You ask us to trust a ship we have never built. Hear why the journey frightens us before you answer."),
        ("Prepare the vessel for departure", "serve", "NEPHI", "The work of many days is ready. Let us bring the household aboard and leave nothing living without care.", ("repair", 3, "Complete the departure checks")),
    ]),
    "BM05": ("storm", "NEPHI", ["SARIAH", "LAMAN", "LEMUEL"], "storm-passenger-care", [
        ("Listen from Nephi's constrained place", "listen", "NEPHI", "I cannot free myself from these bonds. I can still pray, and I can hear the fear of the family around me."),
        ("Support the household in the storm", "serve", "SARIAH", "Help me secure these supplies. Speak to the frightened ones, and keep close while the vessel pitches.", ("repair", 3, "Secure cargo and passenger places")),
        ("Witness the release", "listen", "LAMAN", "The sea has brought us to the end of our strength. We will loose the cords."),
        ("Pray as the sea becomes calm", "pray", "NEPHI", "Lord, guide this vessel and preserve this family. Let our hearts become quiet as the waters become still."),
    ]),
    "BM06": ("stones", "BROTHER_JARED", ["JARED", "CHRIST"], "sixteen-stones", [
        ("Consider light and air inside the hull", "inspect", "JARED", "The vessels will carry our households, but within their close walls we must think carefully about light and air."),
        ("Prepare sixteen clear stones", "serve", "BROTHER_JARED", "These stones are small, yet I will bring what I have prepared before the Lord.", ("collect", 16, "Prepare a clear stone")),
        ("Carry the request up the mountain", "pray", "BROTHER_JARED", "Lord, touch these stones and prepare them that they may shine. We depend upon Thy mercy upon the sea."),
        ("Receive the light and prepare eight vessels", "listen", "BROTHER_JARED", "I have seen the Lord and received light for the journey. Two stones will be placed in each vessel.", ("arrange", 8, "Place two lights for each vessel")),
    ]),
    "BM07": ("barge", "BROTHER_JARED", ["JARED", "BOM_HOUSEHOLDS"], "barge-survival", [
        ("Prepare provisions and animal care", "serve", "JARED", "Let us check the food and the places for the animals. Every household has work in keeping the others safe.", ("arrange", 3, "Check provisions, animals and resting places")),
        ("Secure cargo and attend to the air", "serve", "BROTHER_JARED", "Attend to the opening when it is safe, and keep the cargo secured before the next deep wave.", ("repair", 3, "Secure the vessel's working places")),
        ("Endure the deep waters together", "listen", "BOM_HOUSEHOLDS", "I can still see the stones. Stay beside me until the roar passes."),
        ("Open the vessel at landfall", "serve", "JARED", "There is land beneath us. Let us give thanks, then help the children and those who are tired into the open air."),
    ]),
    "BM08": ("forest", "ENOS", [], "unhurried-prayer", [
        ("Remember the words of your father", "inspect", "ENOS", "The words I had often heard at home have stayed with me. In this quiet place, I begin to understand how deeply I need them."),
        ("Pray for your own soul", "pray", "ENOS", "God, hear my prayer. I bring before Thee the things I cannot put right alone."),
        ("Let the prayer widen to others", "pray", "ENOS", "Remember my people, and those we have called our enemies. Let the hope I have received become hope for them also."),
        ("Leave the wider prayer in the record", "inspect", "ENOS", "I will preserve this witness for those I will never meet, that they may know where to turn."),
    ]),
    "BM09": ("gathering", "BOM_HOUSEHOLDS", ["KING_BENJAMIN"], "gathering-service", [
        ("Help a household find a place", "serve", "BOM_HOUSEHOLDS", "This family cannot hear from behind the tents. We can make room without asking another household to leave.", ("arrange", 3, "Prepare accessible gathering places")),
        ("Carry water and the written message", "serve", "BOM_HOUSEHOLDS", "Some are too far away to hear the king. Let us carry his words and something to drink.", ("serve", 3, "Support the farther households")),
        ("Hear a king speak of service", "listen", "KING_BENJAMIN", "I have labored among you. Remember the people beside you, and let the care you offer them become an offering to God."),
        ("Return the teaching to daily work", "serve", "BOM_HOUSEHOLDS", "There is still a neighbor waiting for help. Let us begin with that person."),
    ]),
    "BM10": ("court", "ALMA_ELDER", ["ABINADI"], "testimony-and-preservation", [
        ("Listen within the hostile court", "listen", "ABINADI", "Listen to the testimony, even when those with power wish it silenced. Consider what the words ask of your own heart."),
        ("Plead and leave the court", "speak", "ALMA_ELDER", "Let this man depart in peace. I cannot put aside what I have heard."),
        ("Find shelter and preserve the testimony", "inspect", "ALMA_ELDER", "I will write the words while I remember them. Fear must not be allowed to erase this witness.", ("collect", 3, "Preserve the remembered testimony")),
        ("Remember Abinadi and choose a changed life", "pray", "ALMA_ELDER", "He has been put to death. I cannot undo this sorrow; I can change the life I lead from this day."),
    ]),
    "BM11": ("waters", "ALMA_ELDER", ["BOM_HOUSEHOLDS"], "covenant-community", [
        ("Prepare a safe approach to the waters", "serve", "BOM_HOUSEHOLDS", "I want to join the gathering. Will you walk beside me where the bank is uneven?", ("arrange", 3, "Prepare the water approach")),
        ("Hear the covenant of mutual care", "listen", "ALMA_ELDER", "We come to carry one another's burdens, mourn with those who mourn, and comfort those who need comfort."),
        ("Participate reverently at the water", "pray", "ALMA_ELDER", "We enter this covenant freely, with a desire to serve God and the people He has placed beside us."),
        ("Share the work after the gathering", "serve", "BOM_HOUSEHOLDS", "We have food to share and work to finish. Let no one leave this place forgotten.", ("serve", 3, "Share food, work and attention")),
    ]),
    "BM12": ("conversion", "ALMA_YOUNGER", ["ANGEL_BOM", "ALMA_ELDER"], "memory-and-repair", [
        ("Remember the road before the warning", "travel", "ALMA_YOUNGER", "I thought I could pull others away without counting what it would cost them. I did not want to look at the harm."),
        ("Attend to the angelic warning", "listen", "ANGEL_BOM", "Remember the faith and prayers offered for you. Do not continue to destroy the work you have opposed."),
        ("Turn your memory toward Christ", "pray", "ALMA_YOUNGER", "Jesus, have mercy upon me. In my anguish I remember the hope I once heard, and I reach for it."),
        ("Begin repairing what you harmed", "serve", "ALMA_ELDER", "You have returned to us. Let the joy of this day become patient work among the people you once troubled.", ("serve", 3, "Begin the work of repair")),
    ]),
    "BM13": ("village", "ABISH", ["LAMONI_QUEEN", "LAMONI", "BOM_HOUSEHOLDS"], "invitation-and-reconciliation", [
        ("Understand the household's encounter", "listen", "ABISH", "I have carried my belief quietly. What has happened here may help my neighbors understand, if I invite them to see."),
        ("Invite the neighbors", "travel", "ABISH", "Come to the house and see for yourselves. I ask you to listen before deciding what this means.", ("serve", 3, "Invite nearby households")),
        ("Listen to the gathered questions", "talk", "BOM_HOUSEHOLDS", "We have heard different explanations. Tell us what you know, and let us hear one another without anger."),
        ("Return to the queen", "serve", "LAMONI_QUEEN", "You have taken my hand. Let us rise and make room for the people who have gathered."),
    ]),
    "BM14": ("covenant", "BOM_HOUSEHOLDS", [], "weapons-and-peace", [
        ("Hear why the weapons are relinquished", "listen", "BOM_HOUSEHOLDS", "We remember what these weapons have done. We choose not to return to that bloodshed."),
        ("Lay the weapons in the earth", "serve", "BOM_HOUSEHOLDS", "Let this be a witness of the life we mean to lead, not a prize taken from another people.", ("arrange", 3, "Bury the relinquished weapons")),
        ("Attend to the threatened people", "serve", "BOM_HOUSEHOLDS", "Stay close to those who are frightened. Our promise does not make their sorrow less real."),
        ("Remember the dead and the changed hearts", "pray", "BOM_HOUSEHOLDS", "We mourn those we have lost. Some who came against us have laid down their arms; let there be room for repentance without forgetting the dead."),
    ]),
    "BM15": ("fort", "CAPTAIN_MORONI", ["LEHI_COMMANDER", "BOM_HOUSEHOLDS"], "two-city-earthworks", [
        ("Inspect the defenses at Ammonihah", "inspect", "CAPTAIN_MORONI", "These approaches once left the city exposed. Place the work where it protects the people, not where it merely looks imposing.", ("arrange", 3, "Inspect ditch, bank and entrance")),
        ("Test the sightlines from the earthworks", "travel", "CAPTAIN_MORONI", "Walk the works at ground level. A plan must be tested from the place where a defender will stand.", ("observe", 3, "Check the protected approaches")),
        ("Continue to the separate city of Noah", "listen", "LEHI_COMMANDER", "The attackers turned away from Ammonihah. Here at Noah we must protect the narrow approach and remain together."),
        ("Care for the wounded defenders", "serve", "LEHI_COMMANDER", "Our people have survived, but some are wounded. Bring water and care before we speak of any success.", ("serve", 3, "Tend the wounded defenders")),
    ]),
    "BM16": ("prison", "ALMA_YOUNGER", ["AMULEK"], "rupture-and-escape", [
        ("Remain beside Amulek in grief", "talk", "AMULEK", "I cannot put away what we have seen. Remain beside me while we wait in this place."),
        ("Endure the confrontation together", "listen", "ALMA_YOUNGER", "We have no strength here to boast of. We will remain together, and turn to God."),
        ("Pray as the prison breaks", "pray", "ALMA_YOUNGER", "Lord, grant us strength and deliverance according to Thy will."),
        ("Emerge through the broken prison", "travel", "AMULEK", "There is an opening. Let us go together into the same town, carrying the memory of those who did not return.", ("navigate", 3, "Follow the clear path outside")),
    ]),
    "BM17": ("fire", "AMINADAB", ["NEPHI_SON_HELAMAN", "LEHI_SON_HELAMAN", "BOM_HOUSEHOLDS"], "darkness-to-shared-light", [
        ("Hear the two sons of Helaman", "listen", "NEPHI_SON_HELAMAN", "My brother Lehi stands beside me. The fire does not consume us; do not be afraid."),
        ("Find the speakers through the darkness", "travel", "AMINADAB", "Listen for their voices. The darkness has made us afraid, but we can still attend to what is being said.", ("observe", 3, "Find the voices in the darkness")),
        ("Help the crowd turn toward prayer", "speak", "AMINADAB", "Cry to the voice that has spoken to you. Let us turn together rather than strike at one another in fear."),
        ("Leave the prison in shared light", "travel", "LEHI_SON_HELAMAN", "There is peace among us now. Carry what you have received out among your families."),
    ]),
    "BM18": ("camp", "TEANCUM", ["BOM_CIVIC_AND_MILITARY"], "two-separated-night-missions", [
        ("Study the first night camp", "inspect", "TEANCUM", "I must understand the paths through the camp before I move. A careless step puts more lives at risk.", ("observe", 3, "Observe the night-camp routes")),
        ("Move quietly toward Amalickiah's tent", "travel", "TEANCUM", "The camp is still. I will take the quiet path and remember the cost of what I am about to do.", ("navigate", 3, "Follow the sheltered approach")),
        ("Return after the first night", "listen", "TEANCUM", "Amalickiah is dead. I have returned to our camp, but the war has not ended."),
        ("Read the later night and Teancum's death", "inspect", "BOM_CIVIC_AND_MILITARY", "On a later night Teancum entered Ammoron's camp. Ammoron was killed, but Teancum did not return. We remember his courage and mourn his death."),
    ]),
    "BM19": ("march", "HELAMAN_COMMANDER", ["BOM_HOUSEHOLDS"], "formation-and-care", [
        ("Prepare provisions and hear the young soldiers", "serve", "BOM_HOUSEHOLDS", "We have brought the teaching of our mothers with us. Help us keep faith with the people we mean to protect.", ("collect", 3, "Prepare the march provisions")),
        ("Maintain the marching formation", "travel", "HELAMAN_COMMANDER", "Keep sight of the people beside you. No one is to be left alone on the road.", ("navigate", 4, "Follow the formation landmarks")),
        ("Coordinate the limited maneuver", "serve", "HELAMAN_COMMANDER", "Wait for the signal, then move together. We depend upon one another more than upon any one person's strength.", ("arrange", 3, "Coordinate the protected positions")),
        ("Tend the wounded and remember home", "serve", "HELAMAN_COMMANDER", "They have survived, yet every one of these wounds needs care. Let us count the people, not trophies.", ("serve", 3, "Bring care to wounded companions")),
    ]),
    "BM20": ("wall", "SAMUEL_LAMANITE", ["BOM_HOUSEHOLDS"], "paced-public-warning", [
        ("Hear the concerns of a household", "talk", "BOM_HOUSEHOLDS", "We worry about tomorrow and scarcely hear the people outside our own door. What is it you ask us to remember?"),
        ("Reach the wall above the gathering", "travel", "SAMUEL_LAMANITE", "I have been sent back with a warning. I must find a place where the people can hear me.", ("navigate", 3, "Follow the approach to the wall")),
        ("Speak with the people in view", "speak", "SAMUEL_LAMANITE", "Do not let your wealth close your ears to the poor or to the call to repentance. The coming of Christ is a promise that asks us to change."),
        ("Leave without turning the warning into vengeance", "travel", "SAMUEL_LAMANITE", "My task was to speak, not to compel belief. I will depart and leave the people free to respond."),
    ]),
    "BM21": ("temple", "BOM_HOUSEHOLDS", ["CHRIST"], "personal-encounter", [
        ("Enter the inhabited temple approach", "travel", "BOM_HOUSEHOLDS", "We have gathered here after so much destruction. Stay with us a moment; people are speaking about what has changed."),
        ("Attend as the gathering grows quiet", "listen", "BOM_HOUSEHOLDS", "There is a voice. Let us be still and listen together."),
        ("Approach the risen Christ", "listen", "CHRIST", "Come near. Let the invitation reach each person among you; no one needs to be lost behind the crowd."),
        ("Return among the gathered households", "talk", "BOM_HOUSEHOLDS", "I thought I would be one face among many. Now I want to make sure my neighbor also has room to come near."),
    ]),
    "BM22": ("temple", "BOM_HOUSEHOLDS", ["CHRIST"], "consented-care-and-children", [
        ("Ask what assistance is wanted", "talk", "BOM_HOUSEHOLDS", "I would like to come closer. Walk beside me, but let me set the pace."),
        ("Accompany the person to the gathering", "serve", "BOM_HOUSEHOLDS", "Thank you for asking. There is room ahead if we go around the edge rather than press through the crowd.", ("serve", 3, "Prepare the accessible approach")),
        ("Make room for the children and remain", "listen", "CHRIST", "Bring the children near. Let this gathering have time for the small, the weary, and those who have waited."),
        ("Return with a family after the encounter", "talk", "BOM_HOUSEHOLDS", "We still have a home to care for and neighbors to help. What we have received belongs in that ordinary work too."),
    ]),
    "BM23": ("peace", "BOM_HOUSEHOLDS", [], "generations-of-shared-work", [
        ("Share the work of the public place", "serve", "BOM_HOUSEHOLDS", "This place belongs to all of us. We can give what we have and ask plainly for what we need.", ("repair", 3, "Maintain the shared public place")),
        ("Bring worship and daily work together", "serve", "BOM_HOUSEHOLDS", "There are hands enough for the garden and time enough to gather, if we do not make another household carry everything.", ("serve", 3, "Share household provisions")),
        ("Mark the passing generations", "inspect", "BOM_HOUSEHOLDS", "Years have passed. The names on these homes have changed, and each generation must learn care for itself."),
        ("Recognize the emerging divisions", "listen", "BOM_HOUSEHOLDS", "There are people now who will not share a table with their neighbors. We must name the division without forgetting what peace once required."),
    ]),
    "BM24": ("cumorah", "MORONI_RECORD_KEEPER", ["MORMON", "BOM_HOUSEHOLDS"], "record-and-survivor-rescue", [
        ("Hear Mormon before the final battle", "listen", "MORMON", "These are my people. I have written of their lives, and my heart breaks at what is coming upon them."),
        ("Find the threatened local passage", "travel", "MORONI_RECORD_KEEPER", "The field is lost in sound and smoke. I can only attend to those within reach.", ("observe", 3, "Find a passable local route")),
        ("Protect the record and help survivors", "serve", "BOM_HOUSEHOLDS", "There is a way through here. Help the wounded, and keep the record from being lost with us.", ("serve", 3, "Help those within reach")),
        ("Remain with the aftermath", "pray", "MORONI_RECORD_KEEPER", "There is no victory to proclaim. I remain to bear witness, and to preserve what love I can for those who come after."),
    ]),
    "BM25": ("burial", "MORONI_RECORD_KEEPER", [], "final-record-and-shared-hill", [
        ("Carry the record through the passing years", "travel", "MORONI_RECORD_KEEPER", "I have been alone for many years. I carry the record because its witness may yet reach someone beyond my sight.", ("navigate", 3, "Follow the sheltered journey")),
        ("Finish the farewell in a sheltered place", "inspect", "MORONI_RECORD_KEEPER", "I leave a promise to those who receive these words: ask God with a sincere heart, and seek the truth through His Spirit."),
        ("Kneel and entrust the record to God", "pray", "MORONI_RECORD_KEEPER", "Lord, receive the labor I can no longer carry. Remember the people whose lives are written here, and those who will one day read."),
        ("Close the earth and remember the future reader", "inspect", "MORONI_RECORD_KEEPER", "My hands must let go of the record. Its next chapter belongs to a reader I have never met."),
    ]),
    "TX01": ("headland", "JOSEPH_MATURE", ["FUTURE_GUIDE", "SURVIVOR"], "same-terrain-era-comparison", [
        ("Learn the garden's hill and spring", "inspect", "FUTURE_GUIDE", "Remember the shape of this hill and the place where the water rises. This imagined mission will return us to the same ground.", ("observe", 3, "Learn the shared landscape landmarks")),
        ("Cross to the imagined desert", "travel", "SURVIVOR", "The ridge is still there. The spring is not safe to drink. Help us restore what we can before promising a different world."),
        ("Open a route into future Zion", "serve", "FUTURE_GUIDE", "The city is not a reward for abandoning the people outside it. Let us make a free and useful crossing.", ("repair", 3, "Prepare the safe crossing")),
        ("Offer assistance across the thresholds", "talk", "SURVIVOR", "Tell us what you can offer, and let us decide what to accept. We have a life here, not only a need to be rescued."),
    ]),
    "TX02": ("disc", "JOSEPH_MATURE", ["FUTURE_GUIDE", "FUTURE_SCIENTIST", "SURVIVOR"], "consented-rescue-flight", [
        ("Ask the travelers where they want to go", "talk", "SURVIVOR", "We want to travel together. Show us where the crossing leads, and what will happen when we arrive."),
        ("Prepare the accessible passenger places", "serve", "FUTURE_SCIENTIST", "Check air, light, water and the places for those who cannot stand. A beautiful vessel is not ready until its passengers are safe.", ("repair", 4, "Prepare light, air, supplies and access")),
        ("Protect the occupants during the crossing", "serve", "FUTURE_GUIDE", "The threshold is unstable. Keep the passengers informed while we secure the systems; no one is cargo.", ("repair", 3, "Stabilize the rescue crossing")),
        ("Help people arrive in a free community", "serve", "SURVIVOR", "We have arrived together. Give us time to find our footing and meet the people here on our own terms."),
    ]),
    "TX03": ("atlas", "JOSEPH_MATURE", ["FUTURE_GUIDE", "FUTURE_SCIENTIST"], "declared-fictional-route-atlas", [
        ("Choose and read the imagined map layer", "inspect", "FUTURE_SCIENTIST", "This map combines eras that did not coexist. The ancient inland seaway predates human life by millions of years; our route is openly fictional."),
        ("Study the southern route and crew safety", "inspect", "FUTURE_GUIDE", "Our imagined passage follows the regions now called Alabama and Florida, then crosses toward the Levant. Mark safe pauses rather than claim a recovered scriptural itinerary.", ("observe", 4, "Study the fictional route waypoints")),
        ("Visit a settlement as guests", "talk", "JOSEPH_MATURE", "We have come to listen and offer what help is welcome. Tell us the customs of this place before we ask to be received."),
        ("Return with consented knowledge", "inspect", "FUTURE_GUIDE", "We bring back only what people freely shared. A mission of love cannot claim to have secretly authored the lives of everyone it meets."),
    ]),
}


LOCATIONS = {
    "BM01": "Jerusalem · household and wilderness road",
    "BM02": "Lehi's dream · wilderness, path and tree",
    "BM03": "Jerusalem · night streets and treasury",
    "BM04": "Arabian Bountiful · shore camp and shipyard",
    "BM05": "Nephi's vessel · storm at sea",
    "BM06": "The brother of Jared's mountain",
    "BM07": "Jaredite vessel · ocean crossing",
    "BM08": "Enos's forest prayer",
    "BM09": "King Benjamin's gathering · temple and tents",
    "BM10": "Noah's court · Alma's shelter",
    "BM11": "The Waters of Mormon",
    "BM12": "Alma's road · symbolic memory and return",
    "BM13": "Lamoni's household and neighboring homes",
    "BM14": "Anti-Nephi-Lehi covenant ground",
    "BM15": "Ammonihah, then the separate city of Noah",
    "BM16": "Ammonihah · prison and town",
    "BM17": "The prison of Nephi and Lehi, sons of Helaman",
    "BM18": "Teancum's two night-camp missions",
    "BM19": "Helaman's march and field-care camp",
    "BM20": "Zarahemla · Samuel's wall",
    "BM21": "American Bountiful · temple gathering",
    "BM22": "American Bountiful · healing and children",
    "BM23": "Fourth Nephi · a community across generations",
    "BM24": "Cumorah · battle and aftermath",
    "BM25": "Moroni's last journey · the shared record hill",
    "TX01": "Imagined headland · garden, desert and future Zion",
    "TX02": "Future Zion · rescue-disc embarkation",
    "TX03": "Fictional temporal atlas · southern sea to Levant",
}

PLAYER_STAGES = {
    "BM05": ["NEPHI", "SARIAH", "NEPHI", "NEPHI"],
    "BM15": ["CAPTAIN_MORONI", "CAPTAIN_MORONI", "LEHI_COMMANDER", "LEHI_COMMANDER"],
    "BM24": ["MORMON", "MORMON", "MORONI_RECORD_KEEPER", "MORONI_RECORD_KEEPER"],
}

ADDITIONAL_LINES = {
    ("BM02", 2): [
        ("LEHI_PATRIARCH", "The fruit has brought me joy, but I look away from it to find the people I love. Where are they upon the path?"),
    ],
    ("BM02", 3): [
        ("LEHI_PATRIARCH", "Come toward the tree. I want you to share what I have received, and I will keep calling while you find the way."),
        ("NEPHI", "We will come together. Let us keep sight of one another as we approach."),
    ],
    ("BM06", 2): [
        ("CHRIST", "I am Jesus Christ, prepared from the beginning to redeem humankind. You have come before me in faith, and I make myself known to you."),
        ("BROTHER_JARED", "I came asking for light for the vessels. Now I stand before the One in whom our hope has rested."),
    ],
    ("BM06", 3): [
        ("JARED", "Then we will carry these lights carefully. We have families to prepare, and a long journey to make together."),
    ],
    ("BM12", 1): [
        ("ALMA_YOUNGER", "The ground beneath all my certainty has given way. I begin to see the people I refused to hear."),
    ],
    ("BM12", 3): [
        ("ALMA_YOUNGER", "Father, I cannot take back the harm by telling you that I am changed. I must go to the people and begin the work."),
        ("ALMA_ELDER", "We have prayed for you with love. Let that same patience guide you as you return to them."),
    ],
    ("BM21", 2): [
        ("CHRIST", "I am Jesus Christ. I have risen, and I stand before you. Come one by one, and know for yourselves the witness of my wounds."),
        ("BOM_HOUSEHOLDS", "There is time for each of us. I can come near without taking another person's place."),
    ],
    ("BM22", 2): [
        ("BOM_HOUSEHOLDS", "We will bring them near and remain with them. No child needs to hurry through this moment."),
    ],
    ("BM25", 1): [
        ("MORONI_RECORD_KEEPER", "Remember the mercy of God as you read. Let your question be joined to real intent and faith in Christ, not to the fear that you have been forgotten."),
    ],
    ("BM25", 3): [
        ("MORONI_RECORD_KEEPER", "Whoever you may be, I have written in hope that you will turn toward Christ. I must leave these words with Him now."),
    ],
}


def build_record_chapters():
    chapters = []
    for source in EXPANSION["scenes"]:
        identity = source["id"]
        family, player, actor_ids, mechanic, beats = PLANS[identity]
        speculative = identity.startswith("TX")
        objectives = []
        for index, beat in enumerate(beats):
            label, kind, speaker, text, *activity = beat
            point = ["gather", "study", "prayer", "journey"][index]
            target = [[-4, 0, 1], [3, 0, -2], [0, 0, -5], [0, 0, 13]][index]
            item = {
                "id": f"{identity}-{index + 1}", "label": label, "point": point,
                "target": target, "kind": kind, "prompt": label,
                "note": source["beats"][index] + " " + source["guardrail"],
                "lines": [{"speaker": speaker, "text": text,
                    "direction": "Original devotional dramatic adaptation, not a scriptural quotation. " + source["guardrail"],
                    "lineId": f"RECORD_{identity}_{index + 1:02d}_01"}],
                "mechanic": {"type": mechanic, "action": kind, "index": index},
            }
            for line_index, (additional_speaker, additional_text) in enumerate(ADDITIONAL_LINES.get((identity, index), []), 2):
                item["lines"].append({
                    "speaker": additional_speaker, "text": additional_text,
                    "direction": "Original devotional dramatic adaptation, not a scriptural quotation. " + source["guardrail"],
                    "lineId": f"RECORD_{identity}_{index + 1:02d}_{line_index:02d}",
                })
            if activity:
                activity_type, count, activity_label = activity[0]
                item["activity"] = {"type": activity_type, "count": count, "label": activity_label}
            if kind == "pray":
                item["effect"] = "light"
            objectives.append(item)
        actors = [{"id": actor_id, "position": [[-5.5, 0, 1], [4.5, 0, -2], [1.5, 0, -5], [7, 0, 2]][index], "rotation": 0, "showFrom": 0} for index, actor_id in enumerate(actor_ids)]
        for person in actors:
            if person["id"] == "CHRIST":
                person["showFrom"] = 2
        if identity == "BM06":
            next(person for person in actors if person["id"] == "CHRIST")["hideAfter"] = 3
        if identity == "BM12":
            next(person for person in actors if person["id"] == "ANGEL_BOM").update({"showFrom": 1, "hideAfter": 1})
            next(person for person in actors if person["id"] == "ALMA_ELDER")["showFrom"] = 3
        chapter = {
            "id": identity, "recordId": identity, "record": True, "optional": True,
            "anchors": source["anchors"], "title": source["title"], "date": source["era"],
            "returnAtAnchor": source["anchors"][0],
            "place": LOCATIONS[identity], "locationDescription": source["space"],
            "environment": f"record-{family}", "playerId": player,
            "status": "Explicit speculative time-mission fiction" if speculative else "Devotional scripture adaptation; staging and dialogue are interpretive",
            "history": source["premise"] + " " + source["guardrail"],
            "perspective": ("An openly fictional temporal mission, not an archaeological reconstruction or official Church doctrine." if speculative else "You now enter an optional dramatization of the ancient record, not a physical journey by Joseph or an event all the witnesses are said to have seen."),
            "intro": source["gameplay"] + ". " + source["premise"],
            "epilogue": source["payoff"], "pacing": "Untimed exploration; duration has not been playtested.", "speculative": speculative,
            "mechanic": mechanic, "stage": family, "panel": source.get("panel"),
            "adaptation": source["guardrail"], "actors": actors, "objectives": objectives,
            "sourceUrls": [EXPANSION["sources"][key] for key in source["sources"] if key in EXPANSION["sources"]],
        }
        if identity in PLAYER_STAGES:
            chapter["playerStages"] = PLAYER_STAGES[identity]
        chapters.append(chapter)
    return chapters
