import plyvel
import leveldb

db  = plyvel.DB('../datadir/leveldb')
dbb = leveldb.LevelDB('../datadir/leveldb')
img = db.get(b'8337212354871836e6763a41e615916c89bac5b3f1f0adf60ba43c7c806e1015')
img1= dbb.Get(b'8337212354871836e6763a41e615916c89bac5b3f1f0adf60ba43c7c806e1015')
img_bytes = img1.decode()

with open("check.png","wb") as file:
	file.write(img_bytes)

db.close()