import numpy as np, librosa
def env(n, a, b, step=0.05):
    y, sr = librosa.load(f'stems/htdemucs/song/{n}.wav', sr=22050, mono=True)
    h=int(sr*step)
    r = librosa.amplitude_to_db(librosa.feature.rms(y=y, hop_length=h, frame_length=2*h)[0], ref=1.0)
    return {round(i*step,2): r[i] for i in range(int(a/step), int(b/step))}
for (a,b) in [(0,18.5),(54,70)]:
    V=env('vocals',a,b); O=env('other',a,b); D=env('drums',a,b)
    print(f"--- {a}-{b}  t voc oth drm")
    for t in V:
        print(f"{t:6.2f} {V[t]:5.0f} {O[t]:5.0f} {D[t]:5.0f} " + "#"*max(0,int((V[t]+60)/2)) + " | " + "*"*max(0,int((O[t]+60)/2)))
