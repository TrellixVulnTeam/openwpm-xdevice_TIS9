from pathlib import Path

from custom_command import GetHBJson,GetHBAds,GetRTBAds,ScrollUp,ScrollDown
from openwpm.command_sequence import CommandSequence
from openwpm.commands.browser_commands import GetCommand,ScreenshotFullPageCommand,SaveScreenshotCommand
from openwpm.commands.profile_commands import DumpProfileCommand
from openwpm.config import BrowserParams, ManagerParams
from openwpm.storage.sql_provider import SQLiteStorageProvider
from openwpm.task_manager import TaskManager

import os
import json
import sys

def copyparams(d1,d2):
    data = d1.to_dict()
    for k,v in d2.items():
        if k not in data:
            d1.custom_params[k] = v

    return d1

def loadjson(path):
    data = {}
    with open(path,"r") as file:
        data = json.load(file)

    return data


config_path  = sys.argv[1] ## Config File Path
mode         = sys.argv[2] ## Flag for Mode ## 1 is ad collection 2 is persona without intent 3 in persona with intent


data = loadjson(config_path)
NUM_BROWSERS = data["Number_of_Browsers"]
sites        = data["Sites"] + data["Intent_Sites"]
Ad_Sites     = data["Ad_Sites"]
pname        = data["profile_archive_dir"]
temp = []
for item in sites:
    temp.append('http://www.'+item)
temp1= []
for item in Ad_Sites:
    temp1.append('http://www.'+item)

sites = temp
Ad_Sites = temp1

t_manager_params = loadjson(data['Manager_Config'])
t_browser_params = loadjson(data['Browser_Config'])

manager_params = ManagerParams(num_browsers=NUM_BROWSERS)
browser_params = [BrowserParams(display_mode="headless") for _ in range(NUM_BROWSERS)]

browser_params = copyparams(browser_params[0],t_browser_params)
manager_params = copyparams(manager_params,t_manager_params)

manager_params.data_directory = Path("./{}".format(pname))
#manager_params.log_path = Path("/opt/openwpm.log")
manager_params.log_path = Path("./{}/openwpm.log".format(pname))

browser_params.profile_archive_dir = Path("./{}".format(pname))
browser_params.seed_tar = Path("./{}/profile.tar.gz".format(pname))
browser_params.dns_instrument = True
browser_params.callstack_instrument = True
browser_params.js_instrument = True
browser_params.navigation_instrument = True
browser_params.cookie_instrument = True
browser_params.http_instrument = True
browser_params.bot_mitigation = True
browser_params.custom_params["mode"] = mode
browser_params.custom_params["path"] = str(browser_params.profile_archive_dir)

if browser_params.custom_params["Intent"] == "NoIntent":
    browser_params.custom_params["ip"] = None
    
path = browser_params.profile_archive_dir
if((not os.path.exists(os.path.join(path,"profile.tar.gz")))):
	browser_params.seed_tar = None

# memory_watchdog and process_watchdog are useful for large scale cloud crawls.
# Please refer to docs/Configuration.md#platform-configuration-options for more information
# manager_params.memory_watchdog = True
# manager_params.process_watchdog = True

browser_params = [browser_params]

print(browser_params[0])
exit()

if(mode == '1'):
# Commands time out by default after 60 seconds
    with TaskManager(
        manager_params,
        browser_params,
        SQLiteStorageProvider(Path("./{}/{}_crawl-data.sqlite".format(pname,mode))),
        None,
    ) as manager:
        # Visits the sites
        for index, site in enumerate(sites):

            def callback(success: bool, val: str = site) -> None:
                print(
                    f"CommandSequence for {val} ran {'successfully' if success else 'unsuccessfully'}"
                )

            # Parallelize sites over all number of browsers set above.
            command_sequence = CommandSequence(
                site,
                site_rank=index,
                callback=callback,
            )

            # Start by visiting the page
            command_sequence.append_command(GetCommand(url=site, sleep=60), timeout=300)


            # Scroll down
            command_sequence.append_command(ScrollDown(), timeout=300)

            #Evidence
            command_sequence.append_command(SaveScreenshotCommand(suffix=str(index)),timeout=100)
            # Scroll up
            command_sequence.append_command(ScrollUp(), timeout=300)
            
            # Run commands across all browsers (simple parallelization)
            manager.execute_command_sequence(command_sequence)


# Commands time out by default after 60 seconds
if(mode == '2'):
    with TaskManager(
        manager_params,
        browser_params,
        SQLiteStorageProvider(Path("./{}/{}_crawl-data.sqlite".format(pname,mode))),
        None,
    ) as manager:
        # Visits the sites
        for index, site in enumerate(Ad_Sites):

            def callback(success: bool, val: str = site) -> None:
                print(
                    f"CommandSequence for {val} ran {'successfully' if success else 'unsuccessfully'}"
                )

            # Parallelize sites over all number of browsers set above.
            command_sequence = CommandSequence(
                site,
                site_rank=index,
                callback=callback,
            )

            # Start by visiting the page
            command_sequence.append_command(GetCommand(url=site, sleep=60), timeout=600)

            # Scroll down
            command_sequence.append_command(ScrollDown(), timeout=300)

            # Scroll up
            command_sequence.append_command(ScrollUp(), timeout=300)
            
            # Get HB Ad
            command_sequence.append_command(GetHBJson(n = index), timeout=600)
            
            # Get HB Images
            command_sequence.append_command(GetHBAds(n = index), timeout=600)
            
            manager.execute_command_sequence(command_sequence)

# Commands time out by default after 60 seconds
if(mode == '3'):
    # Get RTB Ad
    GetRTBAds().execute(None,browser_params[0],None,-1)
