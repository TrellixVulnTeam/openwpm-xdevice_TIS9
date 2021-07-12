import time
import subprocess
import os
import csv

hashes = []
with open("../datadir/tables/http_responses.csv","r") as file:
	reader = csv.reader(file,delimiter=",")

	for line in reader:
		if "img" in line[15]:
			hashes.append(line[19])


with open("Hashes.txt","w") as file:

	for item in hashes:
		file.write(item)
		file.write("\n")