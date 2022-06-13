@echo off

echo This script dumps the lush database. To start executing type the directory path to save files to.

set targetDir=%cd%\data
set /P targetDir="Directory: "
echo %targetDir%
if not exist "%targetDir%" mkdir "%targetDir%"

@REM Dump all data
echo Dumping all data...
mysqldump --databases lush --routines > "%targetDir%\lush_db_data.sql"
echo Lush db dumped.

exit