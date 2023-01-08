import {bind, /* inject, */ BindingScope, Getter} from '@loopback/core';
import {repository} from '@loopback/repository';
import {PlayerRepository, SpreadRepository} from '@src/repositories';
import {SCHEDULE, TIMEZONE} from '@src/utils/constants';
import {MiscHelpers} from '@src/utils/helpers';
import chalk from 'chalk';
import fs from 'fs';
import moment from 'moment';
import momenttz from 'moment-timezone';


@bind({ scope: BindingScope.SINGLETON })
export class ContestService {
    playerRepo: PlayerRepository;
    spreadRepo: SpreadRepository;

    constructor(
        @repository.getter('PlayerRepository') private playerRepoGetter: Getter<PlayerRepository>,
        @repository.getter('SpreadRepository') private spreadRepoGetter: Getter<SpreadRepository>,
    ) {
        (async () => {
            this.playerRepo = await this.playerRepoGetter();
            this.spreadRepo = await this.spreadRepoGetter();
        })();
    }

    async calculateSpread(playerId: number, opponentId: number, type: string) {
        let spread = 0;

        const playerData = await this.playerRepo.findById(playerId);
        if (!playerData) {
            console.log(chalk.redBright(`Player with id: ${playerId} not found`));
        }

        const opponentData = await this.playerRepo.findById(opponentId);
        if (!opponentData) {
            console.log(chalk.redBright(`Opponent with id: ${opponentId} not found`));
        }

        const playerProjectedPoints = playerData ? playerData.projectedFantasyPointsHalfPpr : 0;
        const opponentProjectedPoints = opponentData ? opponentData.projectedFantasyPointsHalfPpr : 0;
        if (type === 'creator') {
            spread = MiscHelpers.roundValue(opponentProjectedPoints - playerProjectedPoints, 0.5);
        } else {
            spread = MiscHelpers.roundValue(playerProjectedPoints - opponentProjectedPoints, 0.5);
        }

        return spread;
    }

    async calculateCover(spread: number, entry: number, winBonus: boolean) {
        let cover = 0;
        const spreadData = await this.spreadRepo.findOne({
            order: ['updatedat DESC'],
            where: {
                projectionSpread: spread,
                spreadType: 'lobby',
            },
        });

        if (winBonus) {
            cover = entry * 0.85 * (spreadData ? spreadData.spreadPay : 0);
        } else {
            cover = entry * (spreadData ? spreadData.spreadPay : 0);
        }
        return cover;
    }

    async calculateWinBonus(spread: number, entry: number) {
        let winBonus = 0;
        const spreadData = await this.spreadRepo.findOne({
            order: ['updatedat DESC'],
            where: {
                projectionSpread: spread,
                spreadType: 'lobby',
            },
        });
        const MLPay = spreadData ? spreadData.mlPay : 0;
        winBonus = entry * 0.15 * MLPay;
        return winBonus;
    }

    async checkPlayerStatus(playerId: number, opponentId: number) {
        const rawData = fs.readFileSync('./src/utils/constants/schedule.week.json', 'utf8');
        const weeklyGames = JSON.parse(rawData);

        const playerData = await this.playerRepo.findById(playerId);
        if (!playerData) {
            console.log(chalk.redBright(`Player with id: ${playerId} not found`));
            return false;
        }

        const opponentData = await this.playerRepo.findById(opponentId);
        if (!opponentData) {
            console.log(chalk.redBright(`Opponent with id: ${opponentId} not found`));
            return false;
        }

        if (
            playerData.isOver ||
            opponentData.isOver ||
            playerData.hasStarted ||
            playerData.hasStarted
        ) {
            console.log(chalk.redBright(`Player(s) have finished playing for this week`));
            return false;
        }

        const currentTime = momenttz().tz(TIMEZONE).add(1, 'minute');
        // const currentTime = momenttz.tz('2021-12-19T10:30:00', TIMEZONE).add(1, 'minute');
        const currentDay = currentTime.day();
        
        const clonedCurrentTime = currentTime.clone();
        let startOfGameWeek = clonedCurrentTime.day(4).startOf('day');
        if (currentDay < 3) {
            startOfGameWeek = clonedCurrentTime.day(-3).startOf('day');
        }

        
        const scheduledGames = weeklyGames.filter((game: { DateTime: number }) => {
            const gameDate = momenttz.tz(game.DateTime, TIMEZONE);
            return gameDate.isBetween(startOfGameWeek, currentTime, 'minute');
        });
        
        const teamList: string[] = [];

        scheduledGames.forEach((scheduledGame: { AwayTeam: string; HomeTeam: string }) => {
            if (scheduledGame.AwayTeam) {
                teamList.push(scheduledGame.AwayTeam);
                
            }
            if (scheduledGame.HomeTeam) {
                teamList.push(scheduledGame.HomeTeam);
            }
        });

        
        if(teamList.includes(playerData.teamName) || teamList.includes(opponentData.teamName)){
            console.log(chalk.redBright(`Player(s) not available for contest`));
            return false;
        }


        return true;
    }

    async checkIfValidTimeslot() {
        const currentTime = moment();
    }
}
