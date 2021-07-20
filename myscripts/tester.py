import time
import subprocess
import os
import csv

hashes = []
p = "../tables/run3/tables3/http_responses.csv"
p2= "../tables/run3/tables3/Hashes.txt"

with open(p,"r") as file:
	reader = csv.reader(file,delimiter=",")

	for line in reader:
		if "image" in line[15] and line[19] != "":
			hashes.append(line[19])


with open(p2,"w") as file:

	for item in hashes:
		file.write(item)
		file.write("\n")