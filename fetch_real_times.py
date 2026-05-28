import requests
import json
import time
from route_map import STATION_COORDS
from metro_data import LINES

# 替换成你刚刚申请的高德 Web服务 Key
AMAP_KEY = "5014602e7782f7a8a8bb978ac069d369"

def get_transit_time_from_amap(start_name, end_name):
    """调用高德API获取两站之间的真实公交/地铁耗时"""
    start_coord = STATION_COORDS.get(start_name)
    end_coord = STATION_COORDS.get(end_name)
    
    if not start_coord or not end_coord:
        return None

    # 高德要求的坐标格式是 "经度,纬度"
    origin = f"{start_coord[0]},{start_coord[1]}"
    destination = f"{end_coord[0]},{end_coord[1]}"
    
    # 调用高德的“公交路径规划” API (city=0592 代表厦门)
    url = f"https://restapi.amap.com/v3/direction/transit/integrated?key={AMAP_KEY}&origin={origin}&destination={destination}&city=0592&strategy=0&nightflag=0"
    
    try:
        response = requests.get(url)
        data = response.json()
        
        # 提取第一条推荐路线的总耗时
        if data["status"] == "1" and int(data["count"]) > 0:
            duration_seconds = int(data["route"]["transits"][0]["duration"])
            return round(duration_seconds / 60, 1)
        else:
            # 💡 新增：把高德的真实拒绝理由大声念出来！
            print(f"❌ 高德拒绝了查询。原因: {data.get('info', '未知')}")
            
    except Exception as e:
        print(f"获取 {start_name} -> {end_name} 失败: {e}")

    return None

def build_real_time_dict():
    """遍历你所有的地铁线，生成真实的耗时字典"""
    real_times = {}
    
    for line_name, info in LINES.items():
        stations = info["stations"]
        for i in range(len(stations) - 1):
            st1 = stations[i]
            st2 = stations[i+1]
            
            print(f"正在查询高德: {st1} -> {st2} ...")
            # 为防被高德拦截，每次请求休息 0.2 秒
            time.sleep(0.2) 
            
            travel_time = get_transit_time_from_amap(st1, st2)
            if travel_time:
                real_times[(st1, st2)] = travel_time
                real_times[(st2, st1)] = travel_time # 双向时间通常一样
                
    # 把结果打印出来，你可以直接复制粘贴到你的 metro_data.py 里！
    print("\n\n====== 采集完成！请把下面这段代码复制到 metro_data.py 中 ======\n")
    print("STATION_TRAVEL_TIMES = {")
    for pair, t in real_times.items():
        print(f"    {pair}: {t},")
    print("}")

if __name__ == "__main__":
    build_real_time_dict()