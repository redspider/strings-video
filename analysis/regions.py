import numpy as np, librosa
step=0.02
def env(n):
    y, sr = librosa.load(f'stems/htdemucs/song/{n}.wav', sr=22050, mono=True)
    h=int(sr*step)
    return librosa.amplitude_to_db(librosa.feature.rms(y=y, hop_length=h, frame_length=2*h)[0], ref=1.0)
def regions(e, thr, mingap=0.15, minlen=0.08):
    on = e>thr; R=[]; s=None
    for i,v in enumerate(on):
        if v and s is None: s=i
        if not v and s is not None: R.append([s*step,i*step]); s=None
    if s is not None: R.append([s*step,len(on)*step])
    M=[]
    for r in R:
        if M and r[0]-M[-1][1]<mingap: M[-1][1]=r[1]
        else: M.append(r)
    return [(round(a,2),round(b,2)) for a,b in M if b-a>=minlen]
V=env('vocals'); O=env('other'); D=env('drums'); B=env('bass')
print("VOCAL regions (>-40dB):", regions(V,-40,0.25))
print("OTHER (guitar) regions 0-20s (>-40dB):", [r for r in regions(O,-40,0.1) if r[0]<20])
print("OTHER regions 110-128:", [r for r in regions(O,-38,0.1) if r[0]>110])
print("DRUM regions (>-45dB):", regions(D,-45,0.8,0.3))
print("BASS regions (>-45dB):", regions(B,-45,0.8,0.3))
