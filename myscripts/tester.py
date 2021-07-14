import time
import subprocess
import os
import csv

hashes = []
with open("../tables/run2/tables/http_responses.csv","r") as file:
	reader = csv.reader(file,delimiter=",")

	for line in reader:
		if "image" in line[15] and line[19] != "":
			hashes.append(line[19])


with open("../tables/run2/tables/Hashes.txt","w") as file:

	for item in hashes:
		file.write(item)
		file.write("\n")