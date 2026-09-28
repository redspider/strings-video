import numpy as np, librosa
S = {}
for n in ['vocals','drums','bass','other']:
    y, sr = librosa.load(f'stems/htdemucs/song/{n}.wav', sr=22050, mono=True)
    r = librosa.feature.rms(y=y, hop_length=2205, frame_length=4410)[0]  # 0.1s
    S[n] = librosa.amplitude_to_db(r, ref=1.0)
T = len(S['vocals'])
print("t(s)   voc   drm   bas   oth")
for i in range(0, T, 5):
    t=i*0.1
    print(f"{t:6.1f} " + " ".join(f"{S[n][i:i+5].mean():5.0f}" for n in ['vocals','drums','bass','other']))
