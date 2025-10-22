import json
import os
import tempfile
import pytest
from unittest.mock import patch, mock_open
from api.src.sota.etl_pipeline import run_etl_for_builder, compute_checksum, load_checksums, save_checksums

def mock_geography_builder():
    yield json.dumps({"state": "छत्तीसगढ़", "districts": []}, ensure_ascii=False)

@pytest.mark.skip(reason="Requires PostgreSQL database connection - integration test")
@patch('api.src.sota.etl_pipeline.save_checksums')
@patch('api.src.sota.etl_pipeline.load_checksums')
@patch('builtins.open', new_callable=mock_open)
def test_run_etl_for_builder_new_data(mock_file, mock_load, mock_save):
    # Mock load checksums returning empty
    mock_load.return_value = {}

    # Run ETL
    run_etl_for_builder(mock_geography_builder, 'geography')

    # Assert save was called with new checksum
    mock_save.assert_called_once()
    args = mock_save.call_args[0][0]
    assert 'geography' in args

@patch('api.src.sota.etl_pipeline.save_checksums')
@patch('api.src.sota.etl_pipeline.load_checksums')
def test_run_etl_for_builder_no_change(mock_load, mock_save):
    # Mock load checksums with existing checksum
    data = json.dumps({"state": "छत्तीसगढ़"}, ensure_ascii=False)
    checksum = compute_checksum(data)
    mock_load.return_value = {'geography': checksum}

    # Run ETL
    run_etl_for_builder(lambda: [data], 'geography')

    # Assert save not called
    mock_save.assert_not_called()

def test_compute_checksum():
    data = "test data"
    checksum = compute_checksum(data)
    assert isinstance(checksum, str)
    assert len(checksum) == 64  # SHA256 length

@patch('os.path.exists')
@patch('builtins.open', new_callable=mock_open, read_data='{"test": "data"}')
def test_load_checksums(mock_file, mock_exists):
    mock_exists.return_value = True
    checksums = load_checksums()
    assert checksums == {"test": "data"}

@patch('os.makedirs')
@patch('builtins.open', new_callable=mock_open)
def test_save_checksums(mock_file, mock_makedirs):
    save_checksums({"test": "data"})
    mock_file.assert_called()
    mock_makedirs.assert_called()
