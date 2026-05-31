import axios from 'axios';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

const API_KEY = process.env.FOOTBALL_API_KEY;
const BASE_URL = process.env.FOOTBALL_API_BASE_URL;

export class FootballDataService {
  static async syncTeamsAndPlayers() {
    try {
      const leagues = ['EPL', 'UCL'];
      
      for (const league of leagues) {
        // Fetch teams for the league
        const teamsResponse = await axios.get(`${BASE_URL}/teams`, {
          params: { league: league === 'EPL' ? 39 : 2, season: 2024 },
          headers: { 'x-rapidapi-key': API_KEY }
        });
        
        for (const teamData of teamsResponse.data.response) {
          const team = await prisma.team.upsert({
            where: { apiId: teamData.team.id },
            update: {
              name: teamData.team.name,
              shortName: teamData.team.code,
              country: teamData.team.country,
              logo: teamData.team.logo,
              league
            },
            create: {
              apiId: teamData.team.id,
              name: teamData.team.name,
              shortName: teamData.team.code,
              country: teamData.team.country,
              logo: teamData.team.logo,
              league
            }
          });
          
          // Fetch players for this team
          const playersResponse = await axios.get(`${BASE_URL}/players`, {
            params: { team: teamData.team.id, season: 2024 },
            headers: { 'x-rapidapi-key': API_KEY }
          });
          
          for (const playerData of playersResponse.data.response) {
            await prisma.player.upsert({
              where: { apiId: playerData.player.id },
              update: {
                name: playerData.player.name,
                position: this.mapPosition(playerData.statistics[0]?.games?.position),
                number: playerData.statistics[0]?.games?.number,
                teamId: team.id
              },
              create: {
                apiId: playerData.player.id,
                name: playerData.player.name,
                position: this.mapPosition(playerData.statistics[0]?.games?.position),
                number: playerData.statistics[0]?.games?.number,
                teamId: team.id
              }
            });
          }
          
          logger.info(`Synced ${playersResponse.data.response.length} players for ${team.name}`);
        }
      }
      
      logger.info('Football data sync completed');
    } catch (error) {
      logger.error('Football data sync error:', error);
      throw error;
    }
  }
  
  static mapPosition(apiPosition) {
    const positionMap = {
      'Goalkeeper': 'GK',
      'Defender': 'DEF',
      'Midfielder': 'MID',
      'Attacker': 'FWD',
      'Forward': 'FWD'
    };
    return positionMap[apiPosition] || 'MID';
  }
  
  static async getTeams(league = null) {
    const where = league ? { league } : {};
    return await prisma.team.findMany({
      where,
      include: { players: true },
      orderBy: { name: 'asc' }
    });
  }
  
  static async getTeamWithPlayers(teamId) {
    return await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true }
    });
  }
}