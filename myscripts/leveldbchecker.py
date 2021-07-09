import plyvel

db  = plyvel.DB('../datadir/leveldb')

img = db.get(b'8337212354871836e6763a41e615916c89bac5b3f1f0adf60ba43c7c806e1015')

#img_bytes = img.decode('utf8','ignore').encode('latin-1')

with open("check.png","wb") as file:
	file.write(img)

db.close()