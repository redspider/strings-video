import numpy as np, librosa
SR=22050
src=open('export_timing.py').read()
ns={}
exec(src.split("yd,_ =")[0], ns)
yd,_ = librosa.load('stems/htdemucs/song/drums.wav', sr=SR, mono=True)
for (a,b,d) in [(20,150,0.25),(1500,5000,0.25),(7000,11000,0.2)]:
    o = ns['band_onsets'](yd,a,b,d)
    lv = np.array([x[1] for x in o]); tt=np.array([x[0] for x in o])
    print(a,b,len(o), np.percentile(lv,[5,25,50,75,95]).round(1))
    m=(tt>20)&(tt<25); print("   20-25s:", [(t,l) for t,l in o if 20<t<25])
