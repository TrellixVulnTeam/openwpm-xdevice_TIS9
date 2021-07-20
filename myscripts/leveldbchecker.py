import plyvel
import os

p = "../data/run4/datadir/leveldb3"
p1= "../tables/run4/images3"

if not os.path.exists(p1):
	os.mkdir(p1)

db  = plyvel.DB(p)

hashes = []
with open("../tables/run4/tables3/Hashes.txt","r") as file:
	lines = file.readlines()
	for line in lines:
		hashes.append(line.strip('\n').strip('\r'))

for index,item in enumerate(hashes):
	img = db.get(str.encode(item))

	print(str.encode(item))
	#print(img)

	if img == None:
		print("none")
		continue

	with open(p1+"/{}check.png".format(str(index)),"wb") as file:
		file.write(img)

db.close()