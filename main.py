import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.ticker import MaxNLocator

# Cài đặt style đồ thị bằng seaborn
sns.set_theme(style="whitegrid", palette="husl")

# 1. Đọc và chuẩn bị dữ liệu
df = pd.read_csv('HCMC_LST_Statistics_2013_2023_3_4_mua_kho.csv')  # Thay đổi tên file nếu cần
df['year'] = df['year'].astype(int)  # Chuyển năm sang số nguyên

# 2. Vẽ biểu đồ nhiệt độ trung bình
plt.figure(figsize=(14, 7))
plt.plot(df['year'], df['urban_mean'], 'o-', color='red', linewidth=2, markersize=8, label='Nội đô')
plt.plot(df['year'], df['suburban_mean'], 'o-', color='blue', linewidth=2, markersize=8, label='Ngoại ô')

plt.title('DIỄN BIẾN NHIỆT ĐỘ TRUNG BÌNH THÁNG 9 TẠI HÀ NỘI (2013-2023)', fontsize=16, pad=20)
plt.xlabel('Năm', fontsize=14)
plt.ylabel('Nhiệt độ (°C)', fontsize=14)
plt.legend(fontsize=12)
plt.grid(True, linestyle='--', alpha=0.6)

# Thêm giá trị nhiệt độ trên các điểm
for year, urb, sub in zip(df['year'], df['urban_mean'], df['suburban_mean']):
    plt.text(year, urb + 0.5, f'{urb:.1f}°C', ha='center', va='bottom', fontsize=10, color='red')
    plt.text(year, sub - 0.5, f'{sub:.1f}°C', ha='center', va='top', fontsize=10, color='blue')

plt.xticks(df['year'])
plt.gca().xaxis.set_major_locator(MaxNLocator(integer=True))
plt.tight_layout()
plt.savefig('temperature_trend.png', dpi=300)
plt.show()

# 3. Vẽ biểu đồ chênh lệch nhiệt độ (Đảo nhiệt đô thị)
plt.figure(figsize=(14, 7))
bars = plt.bar(df['year'], df['temperature_difference'], 
              color=['red' if diff > 0 else 'blue' for diff in df['temperature_difference']])

plt.title('HIỆU ỨNG ĐẢO NHIỆT ĐÔ THỊ HÀ NỘI (2013-2023)', fontsize=16, pad=20)
plt.xlabel('Năm', fontsize=14)
plt.ylabel('Chênh lệch nhiệt độ (Nội đô - Ngoại ô, °C)', fontsize=14)
plt.grid(True, axis='y', linestyle='--', alpha=0.6)

# Thêm giá trị trên các cột
for bar in bars:
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2., height + 0.1,
             f'{height:.1f}°C', ha='center', va='bottom', fontsize=10)

plt.xticks(df['year'])
plt.axhline(0, color='black', linewidth=0.8)
plt.tight_layout()
plt.savefig('urban_heat_island.png', dpi=300)
plt.show()

# 4. Vẽ biểu đồ độ lệch chuẩn
plt.figure(figsize=(14, 7))
plt.fill_between(df['year'], df['urban_mean'] - df['urban_stddev'], 
                 df['urban_mean'] + df['urban_stddev'], color='red', alpha=0.2, label='Nội đô')
plt.fill_between(df['year'], df['suburban_mean'] - df['suburban_stddev'], 
                 df['suburban_mean'] + df['suburban_stddev'], color='blue', alpha=0.2, label='Ngoại ô')
plt.plot(df['year'], df['urban_mean'], 'o-', color='red', linewidth=2, markersize=8)
plt.plot(df['year'], df['suburban_mean'], 'o-', color='blue', linewidth=2, markersize=8)

plt.title('ĐỘ BIẾN ĐỘNG NHIỆT ĐỘ THEO NĂM (ĐỘ LỆCH CHUẨN)', fontsize=16, pad=20)
plt.xlabel('Năm', fontsize=14)
plt.ylabel('Nhiệt độ (°C)', fontsize=14)
plt.legend(fontsize=12)
plt.grid(True, linestyle='--', alpha=0.6)
plt.xticks(df['year'])
plt.tight_layout()
plt.savefig('temperature_variability.png', dpi=300)
plt.show()
