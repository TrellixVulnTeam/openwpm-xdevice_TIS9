import os
import json
import multiprocessing
import time
from multi import process_docker
from multi import monitor_ad

from datetime import datetime

now = datetime.now()
start_time = now.strftime("%H:%M:%S")
with open("start_time.txt","w") as file:
    file.write(str(start_time))
    
p1 = []
p2 = ['Intent','NoIntent']

for d in os.listdir('data/personas/'):
	part = d.split('.json')[0]
	if part not in p1 and ".ipy" not in part:
		p1.append(part)

sets = []

for i in p1:
	for j in p2:
		sets.append('_'.join([i,j]))

print(sets)

for s in sets:

    # creating processes

    p1 = multiprocessing.Process(target=process_docker, args=(s,range(1,26)))
    p2 = multiprocessing.Process(target=process_docker, args=(s,range(26,51)))
    #p3 = multiprocessing.Process(target=process_docker, args=(s,range(67,101)))
    p1.start()
    p2.start()
    #p3.start()

    b1 = multiprocessing.Process(target=monitor_ad, args=(s,range(1,51)))
    b2 = multiprocessing.Process(target=monitor_ad, args=(s,range(34,67)))
    #b3 = multiprocessing.Process(target=monitor_ad, args=(s,range(67,101)))
    b1.start()
    b2.start()
    #b3.start()
