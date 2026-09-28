import numpy as np, json
from beat_this.inference import File2Beats
f2b = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)
beats, downbeats = f2b("song.wav")
beats=np.array(beats); downbeats=np.array(downbeats)
print("n beats", len(beats), "n downbeats", len(downbeats))
ib = np.diff(beats)
print("median IBI", np.median(ib), "bpm", 60/np.median(ib))
print("beats:", np.round(beats,3).tolist())
print("downbeats:", np.round(downbeats,3).tolist())
json.dump({"beats":beats.tolist(),"downbeats":downbeats.tolist()}, open("beats_raw.json","w"))
