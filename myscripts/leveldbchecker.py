import plyvel

db  = plyvel.DB('./leveldb')

hashes = []
with open("Hashes.txt","r") as file:
	lines = file.readlines()
	for line in lines:
		hashes.append(line.strip('\n'))


for index,item in enumerate(hashes):
	img = db.get(str.encode(item))

	print(str.encode(item))
	print(img)

	with open("{}check.png".format(str(index)),"wb") as file:
		file.write(img)


db.close()