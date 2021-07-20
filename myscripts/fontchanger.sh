cp -r ~/Downloads/falling-sky-font/* ~/.fonts/
fc-cache -f -v
mkdir ~/usr_share_bkp
mv /usr/share/fonts/* ~/usr_share_bkp
fc-cache -f -v