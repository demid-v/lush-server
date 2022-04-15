@echo off

echo Dumping structure of the lush database with the drop statement...
set targetDir=%~1
mysqldump --databases lush --no-data --add-drop-database > "%targetDir%\lush_dump_structure_drop_database.sql"
echo Structure of the lush database with the drop statement has been dumped.

exit