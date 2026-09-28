from faster_whisper import WhisperModel
m = WhisperModel("medium.en", device="cpu", compute_type="int8")
segs, info = m.transcribe("stems/htdemucs/song/vocals.wav", word_timestamps=True, vad_filter=False, beam_size=5, condition_on_previous_text=False)
for s in segs:
    print(f"[{s.start:7.2f} - {s.end:7.2f}] {s.text}")
    for w in s.words:
        print(f"      {w.start:7.2f} {w.end:7.2f} {w.word}")
