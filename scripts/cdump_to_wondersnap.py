#!/usr/bin/env python3
"""
Convert HYSPLIT 4D binary `cdump` or CF-compliant NetCDF (`.nc`) footprint files
into compact WebGL2 particle-cloud datasets + 3D coastline vectors for WonderSnap.

Supports:
  1. Direct sparse reading of binary HYSPLIT `cdump` files (~0.2s per 336-hour global run)
  2. Reading converted NetCDF (`.nc`) footprint files via xarray
  3. Optional `--save-nc <dir>` flag to also export CF-compliant NetCDF files
"""

import argparse
import datetime
import json
import math
import os
import sys
import time
from pathlib import Path

import numpy as np

# Add hysplit-strato/src to path for ModelBin & NetCDF utilities
HYSPLIT_STRATO_SRC = Path("/home/sergio.espinosa/hysplit-strato/src")
if HYSPLIT_STRATO_SRC.exists():
    sys.path.insert(0, str(HYSPLIT_STRATO_SRC))

from utilhysplit.hysplit import ModelBin


def read_cdump_sparse(cdump_path: str, max_voxels: int = 8000, n_time_bins: int = 14, seed: int = 42):
    """
    Fast sparse reader for binary HYSPLIT `cdump` files.
    Extracts representative (lat, lon, alt_km, time_hours, weight) samples stratified across
    backward time bins so both near-receptor cores and 14-day long-range filaments are captured.
    """
    rec1, rec2, rec3, rec4a, rec4b, rec5a, rec5b, rec5c, rec6, rec8a, rec8b, rec8c = (
        ModelBin.define_struct()
    )
    rng = np.random.default_rng(seed)

    with open(cdump_path, "rb") as fid:
        h1 = np.fromfile(fid, dtype=rec1, count=1)
        nloc = int(h1["start_loc"][0])
        h2 = np.fromfile(fid, dtype=rec2, count=nloc)
        h3 = np.fromfile(fid, dtype=rec3, count=1)
        h4a = np.fromfile(fid, dtype=rec4a, count=1)
        nlev = int(h4a["nlev"][0])
        h4b = np.fromfile(fid, dtype=rec4b, count=nlev)
        h5a = np.fromfile(fid, dtype=rec5a, count=1)
        npoll = int(h5a["pollnum"][0])
        _ = np.fromfile(fid, dtype=rec5b, count=npoll)
        np.fromfile(fid, dtype=rec5c, count=1)

        s_lat = float(h2["s_lat"][0])
        s_lon = float(h2["s_lon"][0])
        s_ht_m = float(h2["s_ht"][0])
        ry = int(h2["r_year"][0])
        century = 2000 if ry < 50 else 1900
        release_dt = datetime.datetime(
            century + ry,
            int(h2["r_month"][0]),
            int(h2["r_day"][0]),
            int(h2["r_hr"][0]),
            int(h2["r_min"][0]),
        )

        ll_lat = float(h3["llcrnr_lat"][0])
        ll_lon = float(h3["llcrnr_lon"][0])
        dlat = float(h3["dlat"][0])
        dlon = float(h3["dlon"][0])
        lev_tops = h4b["levht"].astype(np.float32)
        lev_centers_km = np.zeros(nlev, dtype=np.float32)
        for i in range(nlev):
            bot = lev_tops[i - 1] if i > 0 else 0.0
            lev_centers_km[i] = 0.5 * (bot + lev_tops[i]) / 1000.0

        # Collect per-step records
        step_records = []
        while True:
            h6 = np.fromfile(fid, dtype=rec6, count=1)
            if h6.size == 0:
                break
            h7 = np.fromfile(fid, dtype=rec6, count=1)
            oy = int(h6["oyear"][0])
            c_o = 2000 if oy < 50 else 1900
            pdate1 = datetime.datetime(
                c_o + oy,
                int(h6["omonth"][0]),
                int(h6["oday"][0]),
                int(h6["ohr"][0]),
                int(h6["omin"][0]),
            )
            oy2 = int(h7["oyear"][0])
            c_o2 = 2000 if oy2 < 50 else 1900
            pdate2 = datetime.datetime(
                c_o2 + oy2,
                int(h7["omonth"][0]),
                int(h7["oday"][0]),
                int(h7["ohr"][0]),
                int(h7["omin"][0]),
            )
            mid_dt = pdate1 + (pdate2 - pdate1) / 2
            age_hours = abs((release_dt - mid_dt).total_seconds()) / 3600.0

            step_lats, step_lons, step_alts, step_concs = [], [], [], []
            for _ in range(npoll):
                for lev_idx in range(nlev):
                    h8a = np.fromfile(fid, dtype=rec8a, count=1)
                    ne = int(h8a["ne"][0])
                    if ne > 0:
                        h8b = np.fromfile(fid, dtype=rec8b, count=ne)
                        indx = h8b["indx"].astype(np.int32)
                        jndx = h8b["jndx"].astype(np.int32)
                        conc = h8b["conc"].astype(np.float32)
                        valid = conc > 0
                        if np.any(valid):
                            lats = ll_lat + (jndx[valid] - 1) * dlat
                            lons = ll_lon + (indx[valid] - 1) * dlon
                            # Normalize lon to [-180, 180]
                            lons = ((lons + 180.0) % 360.0) - 180.0
                            alts = np.full(lats.shape, lev_centers_km[lev_idx], dtype=np.float32)
                            step_lats.append(lats)
                            step_lons.append(lons)
                            step_alts.append(alts)
                            step_concs.append(conc[valid])
                    np.fromfile(fid, dtype=rec8c, count=1)

            if step_concs:
                step_records.append(
                    (
                        age_hours,
                        np.concatenate(step_lats),
                        np.concatenate(step_lons),
                        np.concatenate(step_alts),
                        np.concatenate(step_concs),
                    )
                )

    if not step_records:
        raise ValueError(f"No non-zero plume records in {cdump_path}")

    max_age = max(r[0] for r in step_records)
    bins = np.linspace(0.0, max_age + 0.01, n_time_bins + 1)
    quota_per_bin = max(1, max_voxels // n_time_bins)

    out_lat, out_lon, out_alt, out_age, out_w = [], [], [], [], []

    for b_idx in range(n_time_bins):
        t_lo, t_hi = bins[b_idx], bins[b_idx + 1]
        in_bin = [r for r in step_records if t_lo <= r[0] < t_hi]
        if not in_bin:
            continue
        b_age = np.concatenate([np.full(len(r[1]), r[0], dtype=np.float32) for r in in_bin])
        b_lat = np.concatenate([r[1] for r in in_bin])
        b_lon = np.concatenate([r[2] for r in in_bin])
        b_alt = np.concatenate([r[3] for r in in_bin])
        b_conc = np.concatenate([r[4] for r in in_bin])

        # Filter bottom 15% noise if bin is huge, then importance-sample with conc^0.55
        if len(b_conc) > quota_per_bin * 4:
            thresh = np.quantile(b_conc, 0.20)
            keep = b_conc >= thresh
            b_age, b_lat, b_lon, b_alt, b_conc = (
                b_age[keep],
                b_lat[keep],
                b_lon[keep],
                b_alt[keep],
                b_conc[keep],
            )

        weights = np.power(b_conc / (b_conc.max() + 1e-30), 0.55)
        probs = weights / weights.sum()
        take = min(len(b_conc), quota_per_bin)
        chosen = rng.choice(len(b_conc), size=take, replace=False, p=probs)
        # Sort by age within bin
        chosen = chosen[np.argsort(b_age[chosen])]

        out_lat.append(b_lat[chosen])
        out_lon.append(b_lon[chosen])
        out_alt.append(b_alt[chosen])
        out_age.append(b_age[chosen])
        # Normalized weight 1..10 indicating relative concentration intensity
        norm_w = np.clip(np.round(1.0 + 9.0 * weights[chosen]), 1, 10).astype(np.int32)
        out_w.append(norm_w)

    return {
        "receptor": {
            "lat": round(s_lat, 4),
            "lon": round(s_lon, 4),
            "alt_km": round(s_ht_m / 1000.0, 2),
            "release_date": release_dt.strftime("%Y-%m-%d %H:%M UTC"),
            "max_age_h": round(max_age, 1),
        },
        "lat": np.round(np.concatenate(out_lat), 2).tolist(),
        "lon": np.round(np.concatenate(out_lon), 2).tolist(),
        "alt_km": np.round(np.concatenate(out_alt), 2).tolist(),
        "age_h": np.round(np.concatenate(out_age), 1).tolist(),
        "weight": np.concatenate(out_w).tolist(),
    }


def read_netcdf_footprint(nc_path: str, max_voxels: int = 8000, n_time_bins: int = 14, seed: int = 42):
    """
    Read a CF-compliant HYSPLIT NetCDF (`.nc`) file (same schema as `plot_4d.py`)
    and extract stratified 4D particle samples.
    """
    import xarray as xr

    rng = np.random.default_rng(seed)
    ds = xr.open_dataset(nc_path)
    data_vars = [v for v in ds.data_vars if len(ds[v].dims) >= 3]
    da = ds[data_vars[0]]
    if "y" in da.dims and "latitude" in da.coords:
        da = da.swap_dims({"y": "latitude"})
    if "x" in da.dims and "longitude" in da.coords:
        da = da.swap_dims({"x": "longitude"})
    z_dim = [d for d in da.dims if d.lower() in ["z", "levels", "level", "height"]][0]
    t_dim = [d for d in da.dims if d.lower() in ["time", "t"]][0]

    lats = da.coords["latitude"].values
    lons = da.coords["longitude"].values
    alts_km = da.coords[z_dim].values / 1000.0
    times = da.coords[t_dim].values
    if np.issubdtype(times.dtype, np.datetime64):
        times_h = np.abs((times - times[0]) / np.timedelta64(1, "h"))
    else:
        times_h = np.abs(times - times[0])

    arr = da.values
    idx = np.where(arr > 0)
    pt_age = times_h[idx[0]].astype(np.float32)
    pt_alt = alts_km[idx[1]].astype(np.float32)
    pt_lat = lats[idx[2]].astype(np.float32)
    pt_lon = (((lons[idx[3]] + 180.0) % 360.0) - 180.0).astype(np.float32)
    pt_val = arr[idx].astype(np.float32)

    max_age = float(pt_age.max())
    bins = np.linspace(0.0, max_age + 0.01, n_time_bins + 1)
    quota = max(1, max_voxels // n_time_bins)

    out_lat, out_lon, out_alt, out_age, out_w = [], [], [], [], []
    for b_idx in range(n_time_bins):
        mask = (pt_age >= bins[b_idx]) & (pt_age < bins[b_idx + 1])
        if not np.any(mask):
            continue
        b_lat, b_lon, b_alt, b_age, b_conc = (
            pt_lat[mask],
            pt_lon[mask],
            pt_alt[mask],
            pt_age[mask],
            pt_val[mask],
        )
        weights = np.power(b_conc / (b_conc.max() + 1e-30), 0.55)
        probs = weights / weights.sum()
        take = min(len(b_conc), quota)
        chosen = rng.choice(len(b_conc), size=take, replace=False, p=probs)
        out_lat.append(b_lat[chosen])
        out_lon.append(b_lon[chosen])
        out_alt.append(b_alt[chosen])
        out_age.append(b_age[chosen])
        out_w.append(np.clip(np.round(1.0 + 9.0 * weights[chosen]), 1, 10).astype(np.int32))

    s_lat = ds.attrs.get("source_latitudes", [0.0])
    s_lon = ds.attrs.get("source_longitudes", [0.0])
    s_ht = ds.attrs.get("source_heights", [12000.0])
    s_date = ds.attrs.get("source_dates", [""])
    return {
        "receptor": {
            "lat": round(float(s_lat[0] if np.ndim(s_lat) else s_lat), 4),
            "lon": round(float(s_lon[0] if np.ndim(s_lon) else s_lon), 4),
            "alt_km": round(float(s_ht[0] if np.ndim(s_ht) else s_ht) / 1000.0, 2),
            "release_date": str(s_date[0] if np.ndim(s_date) else s_date),
            "max_age_h": round(max_age, 1),
        },
        "lat": np.round(np.concatenate(out_lat), 2).tolist(),
        "lon": np.round(np.concatenate(out_lon), 2).tolist(),
        "alt_km": np.round(np.concatenate(out_alt), 2).tolist(),
        "age_h": np.round(np.concatenate(out_age), 1).tolist(),
        "weight": np.concatenate(out_w).tolist(),
    }


def export_sparse_netcdf(data: dict, out_nc_path: Path):
    """
    Export the extracted 4D plume to a compact CF-style NetCDF file so every visualization
    scenario also has a corresponding `.nc` artifact on disk.
    """
    import xarray as xr

    rec = data["receptor"]
    ds = xr.Dataset(
        {
            "latitude": (["voxel"], np.array(data["lat"], dtype=np.float32)),
            "longitude": (["voxel"], np.array(data["lon"], dtype=np.float32)),
            "altitude_km": (["voxel"], np.array(data["alt_km"], dtype=np.float32)),
            "backward_age_hours": (["voxel"], np.array(data["age_h"], dtype=np.float32)),
            "sensitivity_weight": (["voxel"], np.array(data["weight"], dtype=np.float32)),
        },
        attrs={
            "title": "HYSPLIT 4D Backward Plume Sparse NetCDF",
            "source_latitudes": float(rec["lat"]),
            "source_longitudes": float(rec["lon"]),
            "source_heights": float(rec["alt_km"] * 1000.0),
            "release_date": rec["release_date"],
            "max_backward_hours": float(rec["max_age_h"]),
        },
    )
    out_nc_path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(out_nc_path)


def extract_coastlines_js(out_js_path: Path):
    """
    Extract Natural Earth 110m coastlines as compact [lat1, lon1, lat2, lon2, ...]
    segments for 3D Earth rendering and continent particle sampling.
    """
    import cartopy.io.shapereader as shpreader

    shp_path = shpreader.natural_earth(resolution="110m", category="physical", name="coastline")
    reader = shpreader.Reader(shp_path)
    segments = []
    for geom in reader.geometries():
        lines = [geom] if geom.geom_type == "LineString" else list(geom.geoms)
        for line in lines:
            coords = list(line.coords)
            # Subsample slightly if very dense, keeping crisp continental shapes
            for i in range(len(coords) - 1):
                lon1, lat1 = coords[i]
                lon2, lat2 = coords[i + 1]
                # Skip antimeridian wrap jumps
                if abs(lon2 - lon1) > 90.0:
                    continue
                segments.extend([round(lat1, 2), round(lon1, 2), round(lat2, 2), round(lon2, 2)])

    out_js_path.write_text(
        f"// Auto-generated from Natural Earth 110m coastlines ({len(segments)//4} line segments)\n"
        f"// Format: flat array [lat1, lon1, lat2, lon2, ...] in degrees.\n"
        f"export const COASTLINE_SEGMENTS = new Float32Array({json.dumps(segments)});\n",
        encoding="utf-8",
    )
    print(f"[OK] Wrote {len(segments)//4} coastline segments to {out_js_path}")


def main():
    parser = argparse.ArgumentParser(description="Convert HYSPLIT cdump/NetCDF files for WonderSnap 3D Earth.")
    parser.add_argument(
        "--out-dir",
        default="/home/sergio.espinosa/wondersnap/src/models",
        help="Output directory for coastline and HYSPLIT data JS modules",
    )
    parser.add_argument(
        "--save-nc",
        default="/home/sergio.espinosa/wondersnap/data_nc",
        help="Directory to also save compact NetCDF (.nc) files for each converted cdump",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    extract_coastlines_js(out_dir / "coastlines.js")

    base = Path("/home/sergio.espinosa/data/footprints/b2sap_network_025")

    # Curated real B2SAP cdump runs:
    # 1) 6 global stations for the Global Network & individual station deep-dives
    global_runs = {
        "boulder_12km": {
            "site": "Boulder, USA (12.0 km)",
            "short": "Boulder, USA",
            "info": "40.0°N, 105.0°W · 12.0 km MSL · Mid-latitude UTLS westerly jet stream",
            "path": base / "2025/01/2025x01x16x18x00x00x39.9356Nx104.9650Wx12000/cdump",
            "voxels": 6500,
        },
        "hilo_19km": {
            "site": "Hilo, Hawaii (19.3 km)",
            "short": "Hilo, Hawaii",
            "info": "19.8°N, 155.4°W · 19.3 km MSL · Subtropical lower-stratospheric Pacific transport",
            "path": base / "2023/09/2023x09x20x22x20x00x19.7828Nx155.4400Wx19250/cdump",
            "voxels": 6500,
        },
        "lareunion_28km": {
            "site": "La Réunion, FRA (28.0 km)",
            "short": "La Réunion, FRA",
            "info": "21.1°S, 55.5°E · 28.0 km MSL · Tropical pipe & Indian Ocean easterly stratospheric belt",
            "path": base / "2022/03/2022x03x31x18x10x00x21.1357Sx055.4886Ex27950/cdump",
            "voxels": 6500,
        },
        "lauder_17km": {
            "site": "Lauder, NZL (17.4 km)",
            "short": "Lauder, NZL",
            "info": "44.8°S, 169.9°E · 17.4 km MSL · Southern Ocean circumpolar Rossby wave train",
            "path": base / "2022/05/2022x05x26x00x20x00x44.7829Sx169.9340Ex17350/cdump",
            "voxels": 6500,
        },
        "utqiagvik_19km": {
            "site": "Utqiaġvik, Alaska (19.3 km)",
            "short": "Utqiaġvik, USA",
            "info": "71.3°N, 155.9°W · 19.3 km MSL · Arctic polar vortex & cross-polar stratospheric flow",
            "path": base / "2023/03/2023x03x15x22x10x00x71.2758Nx155.9370Wx19250/cdump",
            "voxels": 6500,
        },
        "scott_base_24km": {
            "site": "Scott Base, Antarctica (24.3 km)",
            "short": "Scott Base, ANT",
            "info": "78.5°S, 172.9°E · 24.3 km MSL · Antarctic austral spring stratospheric polar vortex",
            "path": base / "2023/10/2023x10x15x01x30x00x78.4869Sx172.8700Ex24250/cdump",
            "voxels": 6500,
        },
    }

    # Find 5 altitudes from the 2020-06-03 Boulder balloon flight (12 km -> 27 km)
    boulder_profile_dirs = sorted((base / "2020/06").glob("2020x06x03*/cdump"))
    target_alts = [12000, 15000, 18000, 22000, 27000]
    profile_runs = {}
    for ta in target_alts:
        best_p = min(
            boulder_profile_dirs,
            key=lambda p: abs(int(p.parent.name.split("x")[-1]) - ta),
        )
        alt_m = int(best_p.parent.name.split("x")[-1])
        key = f"boulder_prof_{alt_m//1000}km"
        profile_runs[key] = {
            "site": f"Boulder Receptor @ {alt_m/1000:.1f} km",
            "short": f"{alt_m/1000:.1f} km MSL",
            "info": f"Boulder, USA (2020-06-03) · Receptor altitude {alt_m/1000:.1f} km MSL",
            "path": best_p,
            "voxels": 2200,
        }

    datasets = {}
    nc_dir = Path(args.save_nc) if args.save_nc else None

    for key, meta in {**global_runs, **profile_runs}.items():
        t0 = time.time()
        p = Path(meta["path"])
        if p.suffix == ".nc":
            d = read_netcdf_footprint(str(p), max_voxels=meta["voxels"])
        else:
            d = read_cdump_sparse(str(p), max_voxels=meta["voxels"])
        d["key"] = key
        d["site"] = meta["site"]
        d["short"] = meta["short"]
        d["info"] = meta["info"]
        datasets[key] = d
        if nc_dir is not None:
            export_sparse_netcdf(d, nc_dir / f"{key}.nc")
        print(
            f"[OK] {key:20s}: {len(d['lat']):5d} 4D voxels extracted in {time.time()-t0:.2f}s "
            f"(receptor: {d['receptor']['lat']}N, {d['receptor']['lon']}E, {d['receptor']['alt_km']}km)"
        )

    out_data_js = out_dir / "hysplit_data.js"
    out_data_js.write_text(
        "// Auto-generated 4D HYSPLIT backward dispersion datasets from real B2SAP cdump / NetCDF runs.\n"
        f"export const HYSPLIT_RUNS = {json.dumps(datasets, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    print(f"[OK] Wrote {out_data_js} ({out_data_js.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
