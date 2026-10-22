LOCAL MOSSlanding VOICE WORKFLOW
================================

No voices have been generated, trained, uploaded, or recorded by the game build.
The game has original procedural ambience and visible dialogue captions. It plays
character voices only when you supply real local audio files. An empty manifest
is intentional; do not treat captions or a voice brief as an existing recording.

1. Run the complete project build or, from the project directory:
     python3 tools/build_game_story.py
     python3 tools/build_voice_index.py

2. Open game/audio/recording-plan.csv. It includes every runtime line: its stable
   line_id, chapter, objective, speaker, spoken text, performance direction, cast
   voice brief, and expected file name. JS_* IDs match the existing report's
   recording manifest. GAME_* IDs are the new playable interaction lines. All
   scripts remain draft adaptations until reviewed and approved for recording.

3. In your local MOSSlanding app, prepare one approved voice identity per speaking
   role. Use the CSV voice brief as performance direction, not as a claim that an
   authenticated voice of a historical or divine person exists. Joseph's four
   age profiles should remain recognizably related; the Father and Christ must
   remain distinct, while Christ and Jehovah are the same identity. Keep a dry
   spoken reference without reverb; apply spatial sound during the game mix.

4. Before training, cloning, recording, or distributing a performance:
   [ ] Confirm consent and rights for the performer and all training/reference
       recordings, including any reuse and distribution of the trained voice.
   [ ] Do not clone a living person's voice from unapproved recordings.
   [ ] Use an appropriately authorized child performance or consenting adult
       portrayal for a child role; do not repurpose a child's recording casually.
   [ ] Record the approval or release reference in the consent_reference column.
   [ ] Review adapted sacred dialogue and historical pronunciation. Do not label
       this script as an exact historical recording or complete verbatim sermon.
   [ ] Review separate singing/tune/text rights before adding the Carthage hymn.
   [ ] Listen for intelligibility, clean edits, clipping, and unwanted artifacts.
       Give grief and prayer room to breathe; do not normalize away every pause.

5. Export your approved take with the exact line ID as its file stem:
     game/audio/takes/JS_03_FATHER_002.wav
     game/audio/takes/GAME_10_03_01.wav
   WAV, MP3, and OGG are indexed. WAV is preferred when multiple formats exist.
   Recommended working masters: mono PCM WAV, 48 kHz, 24-bit, without clipping.
   The runtime uses ordinary browser audio playback; it never calls MOSSlanding
   or an external synthesis API, and never sends your recordings off-device.

6. Run python3 tools/build_voice_index.py again, then reload the game. It scans
   actual nonempty files beneath game/audio/takes/ and updates manifest.json.
   The CSV's recording_status, take, consent_reference, and notes fields survive
   regeneration. A filename is a convention, not an automatic artistic approval;
   only place reviewed takes in this directory.

MANUAL MAPPINGS
---------------
You can explicitly map a stable line ID to a custom relative path:

  {
    "lines": {
      "JS_03_FATHER_002": "takes/father-approved-v2.ogg"
    }
  }

Explicit manifest mappings are preserved and override automatic discoveries.
The engine looks for lineId first, then chapter:objective:zero-based-line, then
SPEAKER_ID|exact line text. For example the first line in chapter 03 objective
03-3 has the fallback key 03:03-3:0. Prefer stable IDs because objective order can
change during development. Paths are relative to game/audio/.

If you intentionally replace an automatically indexed take, either overwrite the
same file or update/remove that line's manifest entry before reindexing. Existing
manifest entries are never silently deleted, even if their files are missing.
Keep raw training data, releases, private voice weights, and working takes out of
the web-served project when they are not intended to be accessible in the game.
