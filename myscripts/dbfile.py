import csv
import sqlite3
import os
import pandas as pd

def to_csv(path):
	if(os.path.exists(path+'/2crawl-data.sqlite') == False):
		return -1
	if(os.path.exists(path+'/tables') == False):
		os.mkdir(path+'/tables')
	db = sqlite3.connect(path+'/2crawl-data.sqlite')
	cursor = db.cursor()
	cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
	tables = cursor.fetchall()
	for table_name in tables:
		table_name = table_name[0]
		table = pd.read_sql_query("SELECT * from %s" % table_name, db)
		table.to_csv(path+'/tables/'+table_name + '.csv', index_label='index', encoding='utf-8')
	cursor.close()
	db.close()
	return 1

to_csv("../run1_datadir")