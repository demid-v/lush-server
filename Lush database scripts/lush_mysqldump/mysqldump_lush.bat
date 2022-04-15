@echo off

echo This script dumps the lush database. To start executing type the directory path to save files to.

set targetDir=%cd%\lush_dump
set /P targetDir="Directory: "
echo %targetDir%
if not exist "%targetDir%" mkdir "%targetDir%"

@REM Dump structure.
start dump_lush_structure "%targetDir%"

@REM Dump structure with drop statement.
start dump_lush_structure_drop_statement "%targetDir%"

@REM Dump all databases except audio_blob.
start dump_lush_tables_except_audio_blob "%targetDir%"

@REM Dump the audio_blob table.
start dump_lush_table_audio_blob "%targetDir%"