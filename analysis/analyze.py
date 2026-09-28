import numpy as np, librosa, json
y, sr = librosa.load('song.wav', sr=22050, mono=True)
dur = len(y)/sr
hop=512
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
# silence regions
db = librosa.amplitude_to_db(rms, ref=np.max)
print("duration", dur)
# print 0.5s-binned loudness for first 30s and overall 1s bins
for i in range(0, int(dur)):
    m = (t>=i)&(t<i+1)
    print(f"{i:4d}s {db[m].mean():6.1f} dB", end=" | " if i%6!=5 else "\n")
print()
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, units='time')
print("tempo", tempo)
print("n beats", len(beats))
print("beats", np.round(beats,3).tolist())
onsets = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=hop, units='time', backtrack=False)
print("onsets", np.round(onsets,3).tolist())
