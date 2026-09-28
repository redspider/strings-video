import numpy as np, librosa
y, sr = librosa.load('stems/htdemucs/song/vocals.wav', sr=22050, mono=True)
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)
on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=256, units='time', delta=0.15)
f0, vf, vp = librosa.pyin(y[int(54*sr):int(70*sr)], fmin=80, fmax=800, sr=sr, hop_length=256)
tt = 54 + np.arange(len(f0))*256/sr
for a,b in [(8.8,16.3),(55.3,58.6),(61.0,64.9),(65.5,69.3)]:
    print(f"{a}-{b}:", [round(x,2) for x in on if a<=x<=b])
# voiced segments with pitch in 54-70
seg=[];s=None
for i,v in enumerate(vf):
    if v and s is None: s=i
    if (not v) and s is not None:
        if (i-s)*256/sr>0.08: seg.append((round(tt[s],2),round(tt[i],2), int(np.nanmedian(f0[s:i]))))
        s=None
print("voiced 54-70:", seg)
