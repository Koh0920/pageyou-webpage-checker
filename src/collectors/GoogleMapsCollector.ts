import axios from 'axios';
import { stringify } from 'csv-stringify/sync';
import { writeFileSync } from 'fs';
import { BusinessInfo } from '../types';
import { API_ENDPOINTS } from '../config/constants';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

interface SearchParams {
  location: string;
  radius: number;
  types: string[];
  language: 'ja';
  maxResults: number;
}

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface PlaceDetails {
  result: {
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    website?: string;
    opening_hours?: {
      weekday_text: string[];
    };
    rating?: number;
    user_ratings_total?: number;
    types: string[];
  };
}

export class GoogleMapsCollector {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async collectBusinesses(params: SearchParams, config?: any): Promise<BusinessInfo[]> {
    if (!this.apiKey) {
      logger.error('Google Maps APIキーが設定されていません');
      return [];
    }

    const businesses: BusinessInfo[] = [];
    const processedPlaceIds = new Set<string>();

    try {
      // 業種タイプごとに検索
      for (const type of params.types) {
        const searchResults = await this.searchPlaces(params.location, params.radius, type);
        
        for (const place of searchResults) {
          if (processedPlaceIds.has(place.place_id)) {
            continue;
          }
          processedPlaceIds.add(place.place_id);

          // フィルタリング
          if (config?.filters) {
            if (config.filters.minRating && place.rating && place.rating < config.filters.minRating) {
              continue;
            }
          }

          // 詳細情報を取得
          const details = await this.getPlaceDetails(place.place_id);
          
          if (!details || !details.result.website) {
            continue; // Webサイトがない場合はスキップ
          }

          // チェーン店の除外（オプション）
          if (config?.filters?.excludeChains && this.isChainStore(details.result.name)) {
            continue;
          }

          const businessInfo: BusinessInfo = {
            url: details.result.website,
            businessName: details.result.name,
            industry: this.mapTypesToIndustry(details.result.types),
            location: this.extractWard(details.result.formatted_address)
          };

          businesses.push(businessInfo);

          if (businesses.length >= params.maxResults) {
            break;
          }
        }

        if (businesses.length >= params.maxResults) {
          break;
        }
      }

      logger.info(`${businesses.length}件の事業者情報を収集しました`);
      return businesses;

    } catch (error) {
      logger.error('Google Maps API エラー:', error);
      return businesses;
    }
  }

  private async searchPlaces(location: string, radius: number, type: string): Promise<PlaceResult[]> {
    const params = {
      location: await this.geocodeLocation(location),
      radius,
      type,
      language: 'ja',
      key: this.apiKey
    };

    try {
      const response = await axios.get(`${API_ENDPOINTS.googlePlaces}`, { params });
      return response.data.results || [];
    } catch (error) {
      logger.error(`場所検索エラー (${type}):`, error);
      return [];
    }
  }

  private async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    const params = {
      place_id: placeId,
      fields: 'name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,types',
      language: 'ja',
      key: this.apiKey
    };

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', { params });
      return response.data;
    } catch (error) {
      logger.error(`詳細取得エラー (${placeId}):`, error);
      return null;
    }
  }

  private async geocodeLocation(location: string): Promise<string> {
    // 地名を座標に変換
    if (location.includes(',')) {
      return location; // すでに座標の場合
    }

    const params = {
      address: location,
      language: 'ja',
      key: this.apiKey
    };

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', { params });
      const result = response.data.results[0];
      if (result) {
        const { lat, lng } = result.geometry.location;
        return `${lat},${lng}`;
      }
    } catch (error) {
      logger.error(`ジオコーディングエラー (${location}):`, error);
    }

    // デフォルト（東京駅）
    return '35.6812,139.7671';
  }

  private mapTypesToIndustry(types: string[]): string {
    const typeMapping: Record<string, string> = {
      restaurant: 'restaurant',
      cafe: 'restaurant',
      food: 'restaurant',
      beauty_salon: 'beauty',
      hair_care: 'beauty',
      spa: 'beauty',
      clinic: 'clinic',
      hospital: 'clinic',
      dentist: 'clinic',
      doctor: 'clinic',
      store: 'retail',
      shopping_mall: 'retail',
      clothing_store: 'retail',
      lawyer: 'legal',
      accounting: 'legal',
      gym: 'fitness',
      school: 'education'
    };

    for (const type of types) {
      if (typeMapping[type]) {
        return typeMapping[type];
      }
    }

    return 'other';
  }

  private extractWard(address: string): string {
    // 住所から区を抽出
    const wardMatch = address.match(/([^市]+[市区町村])/);
    return wardMatch ? wardMatch[1] : address.split(' ')[0];
  }

  private isChainStore(name: string): boolean {
    // 主要なチェーン店名のパターン
    const chainPatterns = [
      'スターバックス',
      'マクドナルド',
      'セブンイレブン',
      'ファミリーマート',
      'ローソン',
      'ドトール',
      'サイゼリヤ',
      'ガスト',
      'すき家',
      '吉野家',
      'ユニクロ'
    ];

    return chainPatterns.some(pattern => name.includes(pattern));
  }

  async exportToCSV(businesses: BusinessInfo[], outputPath: string): Promise<void> {
    const csvData = businesses.map(business => ({
      URL: business.url,
      業種: business.industry,
      地域: business.location,
      事業者名: business.businessName
    }));

    const csv = stringify(csvData, { header: true });
    writeFileSync(outputPath, csv, 'utf-8');
    
    logger.info(`CSVファイルを出力しました: ${outputPath}`);
  }
}