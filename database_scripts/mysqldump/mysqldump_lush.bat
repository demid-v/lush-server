@echo off

echo This script dumps the lush database. To start executing type the directory path to save files to.

set targetDir=%cd%\lush_dump
set /P targetDir="Directory: "
echo %targetDir%
if not exist "%targetDir%" mkdir "%targetDir%"

@REM Dump structure.
start dump_structure "%targetDir%"

@REM Dump structure with drop statement.
start dump_structure_drop_statement "%targetDir%"

@REM Dump all data.
start dump_tables "%targetDir%"
