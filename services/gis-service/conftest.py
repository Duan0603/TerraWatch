import sys
from pathlib import Path

# Add services/gis-service to sys.path so 'app.*' imports work during tests from anywhere
sys.path.insert(0, str(Path(__file__).resolve().parent))
