-- Which DJI account (for example procam1) each drone is bound to, kept on the drone next to its serial number (Admin > Drone Rental).
alter table dr_drones add column dji_account text;
