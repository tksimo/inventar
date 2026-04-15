"""INFRA-01 / INFRA-02: the HA add-on manifest is valid and complete."""
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_config_yaml_fields():
    cfg = yaml.safe_load((REPO_ROOT / "config.yaml").read_text(encoding="utf-8"))
    assert cfg["slug"] == "inventar"
    assert cfg["ingress"] is True
    assert cfg["ingress_port"] == 8099
    assert cfg["panel_icon"] == "mdi:package-variant-closed"
    assert cfg["panel_title"] == "Inventar"
    assert cfg["init"] is False
    assert cfg["arch"] == ["amd64"]
    assert cfg["ports"] == {"8099/tcp": 8099}
    assert "data:rw" in cfg["map"]


def test_build_yaml_base_image():
    b = yaml.safe_load((REPO_ROOT / "build.yaml").read_text(encoding="utf-8"))
    assert b["build_from"]["amd64"] == "ghcr.io/home-assistant/base-python:3.12-alpine3.23"
