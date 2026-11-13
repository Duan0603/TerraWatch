"""List exact cells/bags used by the cached demo trainer; does not train or infer."""
from pathlib import Path

import pandas as pd
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'gpu-training-kit/data/processed'
EXP = ROOT / 'gpu-training-kit/experiments/vietnam_1km_two_branch_gru'


def coordinates(frame):
    # These are grid-cell centres, not surveyed landslide locations.
    parts = frame.unit_id.str.rsplit('_', n=2, expand=True)
    lon, lat = transform('EPSG:32648', 'EPSG:4326',
                         (parts[1].astype(float)+500).tolist(), (parts[2].astype(float)+500).tolist())
    return frame.assign(cell_center_latitude=lat, cell_center_longitude=lon)


def main():
    spatial = pd.read_csv(DATA / 'two_branch_gru_option_b/spatial_train_12districts_7052.csv', keep_default_na=False)
    fields = ['district', 'unit_id', 'spatial_proxy_label', 'slope_deg', 'elevation_m',
              'clay_pct', 'sand_pct', 'bulk_density_g_cm3']
    coordinates(spatial[fields]).to_csv(ROOT / 'docs/gru-spatial-training-cells.csv', index=False, encoding='utf-8-sig')
    cohort = pd.read_csv(DATA / 'footprint_two_branch_experiment/footprint_spatiotemporal_proxy_2693.csv', keep_default_na=False)
    context = pd.read_csv(DATA / 'next24h_local_day_gfs_context/candidate_context_with_gfs.csv', keep_default_na=False, low_memory=False)
    parents = pd.read_csv(DATA / 'next24h_local_day_candidates/parent_window_relations.csv', keep_default_na=False)
    links = pd.read_csv(DATA / 'grid_rain_research/window_source_relations.csv', keep_default_na=False)
    audit = pd.read_csv(DATA / 'label_audit/all_audited_records.csv', keep_default_na=False, low_memory=False)
    records = links.merge(audit[['record_id', 'original_district']], left_on='source_record_id', right_on='record_id', how='left')
    district_by_window = records.groupby('window_id').original_district.agg(lambda x: ','.join(sorted(set(x.dropna())-{''})))
    windows = parents.merge(links[['window_id', 'source_kind']].drop_duplicates(),
                            left_on='parent_research_window_id', right_on='window_id').merge(
                                context[context.all_research_context_coverage_complete.astype(str) == 'True'], on='sample_id')
    windows = windows[(windows.source_kind == 'point_coordinate_only')
                      & (windows.parent_association_date_start < windows.parent_association_date_end_inclusive)
                      & (windows.parent_association_date_end_inclusive <= '2018-09-01')]
    bags = []
    for window_id, group in windows.groupby('parent_research_window_id'):
        group = group.drop_duplicates('target_local_date').sort_values('target_local_date')
        row = group.iloc[0]
        start, end = row.parent_association_date_start, row.parent_association_date_end_inclusive
        if len(group) == (pd.Timestamp(end)-pd.Timestamp(start)).days+1:
            bags.append(dict(bag_id='mil_pos_'+window_id, unit_id=row.unit_id,
                             district=district_by_window[window_id], start_date=start, end_date=end,
                             instances=len(group), tier='TIER_B_MULTIDAY_BAG', training_target=1))
    assert len(bags) == 2104 and sum(b['instances'] for b in bags) == 6128
    negative = pd.read_csv(EXP / 'outputs/tier_b_in_window_negatives_432.csv', keep_default_na=False)
    for rows, tier, prefix, target in ((cohort[cohort.split_chronological == 'train'], 'TIER_A_SINGLE_DAY', 'tier_a_', None),
                                       (negative, 'TIER_B_IN_WINDOW_NON_EVENT', 'tier_b_neg_', 0)):
        for row in rows.itertuples():
            bags.append(dict(bag_id=prefix+row.sample_id, unit_id=row.unit_id, district=row.district,
                             start_date=row.target_local_date, end_date=row.target_local_date, instances=1,
                             tier=tier, training_target=int(row.is_storm_day_window) if target is None else target))
    assert len(bags) == 2652 and len(spatial) == 7060
    frame = pd.DataFrame(bags)
    assert frame.district.ne('').all() and frame.bag_id.is_unique
    coordinates(frame).to_csv(ROOT / 'docs/gru-temporal-training-bags.csv', index=False, encoding='utf-8-sig')
    print(frame.groupby(['district', 'tier']).size().unstack(fill_value=0).to_string())
    print('Exported 7060 spatial cells and 2652 temporal bags; coordinates are grid-cell centres.')


if __name__ == '__main__':
    main()
