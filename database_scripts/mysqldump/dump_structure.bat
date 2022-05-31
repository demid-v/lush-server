@echo off

echo Dumping structure of the lush database...
set targetDir=%~1
mysqldump --databases lush --no-data > "%targetDir%\lush_dump_structure.sql"
echo Structure of the lush database has been dumped.

exit