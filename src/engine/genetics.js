/**
 * レオパードゲッコー 遺伝計算エンジン
 * 
 * パンネットスクエア方式で交配結果を計算する。
 * 各遺伝子座は独立して分離する（独立分離の法則）。
 */

/**
 * 親の遺伝子型を表現するオブジェクト
 * 各遺伝子座に対して以下の状態を持つ:
 * - 'homozygous': ホモ接合体（表現型として発現）
 * - 'heterozygous': ヘテロ接合体（het、キャリア）
 * - 'possible_het': ポッシブルhet（50%の確率でhet）
 * - 'wild': 野生型（非保有）
 * - 'super': スーパー体（共優性のホモ接合体）
 */

class GeneticsEngine {

    constructor(morphDatabase) {
        this.morphDB = morphDatabase;
    }

    /**
     * メイン計算: 2匹の親から子の遺伝型確率を算出
     * @param {Object} parent1 - 親1の遺伝子型 { morphId: status, ... }
     * @param {Object} parent2 - 親2の遺伝子型 { morphId: status, ... }
     * @returns {Array} 子の遺伝型と確率の配列
     */
    calculate(parent1, parent2) {
        // アルビノ系統の互換性チェック
        const albinoCheck = this.checkAlbinoCompatibility(parent1, parent2);
        if (albinoCheck.error) {
            return { error: albinoCheck.error, results: [] };
        }

        // 全遺伝子座を収集
        const allLoci = new Set([...Object.keys(parent1), ...Object.keys(parent2)]);

        // 各遺伝子座ごとに計算
        const lociResults = {};
        for (const locus of allLoci) {
            const morphInfo = this.morphDB[locus];
            if (!morphInfo) continue;

            const p1Status = parent1[locus] || 'wild';
            const p2Status = parent2[locus] || 'wild';

            switch (morphInfo.type) {
                case 'recessive':
                    lociResults[locus] = this.calculateRecessive(locus, p1Status, p2Status);
                    break;
                case 'dominant':
                    lociResults[locus] = this.calculateDominant(locus, p1Status, p2Status);
                    break;
                case 'codominant':
                    lociResults[locus] = this.calculateCodominant(locus, p1Status, p2Status);
                    break;
                default:
                    break;
            }
        }

        // 全遺伝子座の結果を組み合わせて最終結果を算出
        const combined = this.combineResults(lociResults);
        return { error: null, results: combined };
    }

    /**
     * 劣性遺伝の計算
     * AA = 野生型, Aa = het, aa = ホモ接合体（表現）
     */
    calculateRecessive(locus, p1Status, p2Status) {
        const p1Alleles = this.getRecessiveAlleles(p1Status);
        const p2Alleles = this.getRecessiveAlleles(p2Status);

        return this.punnettSquare(locus, p1Alleles, p2Alleles, 'recessive');
    }

    /**
     * 優性遺伝の計算
     * DD = ホモ優性, Dd = ヘテロ優性（表現）, dd = 野生型
     */
    calculateDominant(locus, p1Status, p2Status) {
        const p1Alleles = this.getDominantAlleles(p1Status);
        const p2Alleles = this.getDominantAlleles(p2Status);

        return this.punnettSquare(locus, p1Alleles, p2Alleles, 'dominant');
    }

    /**
     * 共優性の計算
     * SS = スーパー体, Ss = ヘテロ（表現）, ss = 野生型
     */
    calculateCodominant(locus, p1Status, p2Status) {
        const p1Alleles = this.getCodominantAlleles(p1Status);
        const p2Alleles = this.getCodominantAlleles(p2Status);

        return this.punnettSquare(locus, p1Alleles, p2Alleles, 'codominant');
    }

    /**
     * 劣性遺伝のアレル取得
     */
    getRecessiveAlleles(status) {
        switch (status) {
            case 'homozygous': return ['a', 'a'];    // 表現型
            case 'heterozygous': return ['A', 'a'];   // 100% het
            case 'possible_het': return [['A', 'A'], ['A', 'a']]; // 50% chance het
            case 'wild': return ['A', 'A'];           // 野生型
            default: return ['A', 'A'];
        }
    }

    /**
     * 優性遺伝のアレル取得
     */
    getDominantAlleles(status) {
        switch (status) {
            case 'homozygous': return ['D', 'D'];     // ホモ優性
            case 'heterozygous': return ['D', 'd'];   // ヘテロ優性
            case 'wild': return ['d', 'd'];           // 野生型
            default: return ['d', 'd'];
        }
    }

    /**
     * 共優性のアレル取得
     */
    getCodominantAlleles(status) {
        switch (status) {
            case 'super': return ['S', 'S'];          // スーパー体
            case 'homozygous': return ['S', 's'];     // ヘテロ（表現型）
            case 'heterozygous': return ['S', 's'];   // ヘテロ
            case 'wild': return ['s', 's'];           // 野生型
            default: return ['s', 's'];
        }
    }

    /**
     * パンネットスクエア計算
     */
    punnettSquare(locus, p1Alleles, p2Alleles, type) {
        // possible_het の場合は2パターンの平均を取る
        if (Array.isArray(p1Alleles[0]) || Array.isArray(p2Alleles[0])) {
            return this.calculateWithPossibleHet(locus, p1Alleles, p2Alleles, type);
        }

        const outcomes = {};
        for (const a1 of p1Alleles) {
            for (const a2 of p2Alleles) {
                const genotype = this.normalizeGenotype(a1, a2, type);
                if (!outcomes[genotype]) {
                    outcomes[genotype] = 0;
                }
                outcomes[genotype] += 0.25; // 各マスは1/4
            }
        }

        return this.interpretOutcomes(locus, outcomes, type);
    }

    /**
     * possible_het を含む計算
     */
    calculateWithPossibleHet(locus, p1Alleles, p2Alleles, type) {
        const p1Options = Array.isArray(p1Alleles[0]) ? p1Alleles : [p1Alleles];
        const p2Options = Array.isArray(p2Alleles[0]) ? p2Alleles : [p2Alleles];

        const combinedOutcomes = {};
        const weight = 1 / (p1Options.length * p2Options.length);

        for (const p1 of p1Options) {
            for (const p2 of p2Options) {
                for (const a1 of p1) {
                    for (const a2 of p2) {
                        const genotype = this.normalizeGenotype(a1, a2, type);
                        if (!combinedOutcomes[genotype]) {
                            combinedOutcomes[genotype] = 0;
                        }
                        combinedOutcomes[genotype] += weight * 0.25;
                    }
                }
            }
        }

        return this.interpretOutcomes(locus, combinedOutcomes, type);
    }

    /**
     * 遺伝子型の正規化（ソート）
     */
    normalizeGenotype(a1, a2, type) {
        if (type === 'recessive') {
            // 大文字（優性）を先に
            return a1 <= a2 ? a1 + a2 : a2 + a1;
        }
        return a1 <= a2 ? a1 + a2 : a2 + a1;
    }

    /**
     * パンネットスクエア結果の解釈
     */
    interpretOutcomes(locus, outcomes, type) {
        const results = [];
        const morphInfo = this.morphDB[locus];

        for (const [genotype, probability] of Object.entries(outcomes)) {
            if (probability <= 0) continue;

            let phenotype, status;

            switch (type) {
                case 'recessive':
                    if (genotype === 'aa') {
                        phenotype = morphInfo.name;
                        status = 'homozygous';
                    } else if (genotype === 'Aa' || genotype === 'aA') {
                        phenotype = `het ${morphInfo.name}`;
                        status = 'heterozygous';
                    } else {
                        phenotype = 'Normal';
                        status = 'wild';
                    }
                    break;

                case 'dominant':
                    if (genotype === 'DD') {
                        phenotype = `${morphInfo.name} (Homozygous)`;
                        status = 'homozygous';
                    } else if (genotype === 'Dd' || genotype === 'dD') {
                        phenotype = morphInfo.name;
                        status = 'heterozygous';
                    } else {
                        phenotype = 'Normal';
                        status = 'wild';
                    }
                    break;

                case 'codominant':
                    if (genotype === 'SS') {
                        phenotype = morphInfo.superForm || `Super ${morphInfo.name}`;
                        status = 'super';
                    } else if (genotype === 'Ss' || genotype === 'sS') {
                        phenotype = morphInfo.name;
                        status = 'homozygous';
                    } else {
                        phenotype = 'Normal';
                        status = 'wild';
                    }
                    break;
            }

            results.push({
                locus,
                genotype,
                phenotype,
                status,
                probability: Math.round(probability * 10000) / 100, // パーセント表示
            });
        }

        return results;
    }

    /**
     * 全遺伝子座の結果を組み合わせる（独立分離の法則）
     */
    combineResults(lociResults) {
        const loci = Object.keys(lociResults);
        if (loci.length === 0) return [];

        // 最初の遺伝子座から開始
        let combined = lociResults[loci[0]].map(r => ({
            traits: [{ locus: r.locus, phenotype: r.phenotype, status: r.status }],
            probability: r.probability,
        }));

        // 残りの遺伝子座を順次掛け合わせ
        for (let i = 1; i < loci.length; i++) {
            const locusResults = lociResults[loci[i]];
            const newCombined = [];

            for (const existing of combined) {
                for (const locusResult of locusResults) {
                    newCombined.push({
                        traits: [
                            ...existing.traits,
                            { locus: locusResult.locus, phenotype: locusResult.phenotype, status: locusResult.status },
                        ],
                        probability: (existing.probability * locusResult.probability) / 100,
                    });
                }
            }

            combined = newCombined;
        }

        // 確率でソート（高い順）
        combined.sort((a, b) => b.probability - a.probability);

        // 極小確率のものを除外 & 確率0のものを除外
        combined = combined.filter(c => c.probability >= 0.01);

        // 表示名を生成
        return combined.map(c => ({
            ...c,
            displayName: this.generateDisplayName(c.traits),
            probability: Math.round(c.probability * 100) / 100,
        }));
    }

    /**
     * 表示名の生成
     */
    generateDisplayName(traits) {
        const visibleTraits = [];
        const hetTraits = [];

        for (const t of traits) {
            if (t.status === 'wild') continue;

            if (t.status === 'heterozygous' && this.morphDB[t.locus]?.type === 'recessive') {
                hetTraits.push(this.morphDB[t.locus]?.name || t.phenotype);
            } else {
                visibleTraits.push(t.phenotype);
            }
        }

        let name = visibleTraits.length > 0 ? visibleTraits.join(' ') : 'Normal';
        if (hetTraits.length > 0) {
            name += ` het ${hetTraits.join(', ')}`;
        }

        return name;
    }

    /**
     * アルビノ系統の互換性チェック
     */
    checkAlbinoCompatibility(parent1, parent2) {
        const p1Albinos = this.getAlbinoTypes(parent1);
        const p2Albinos = this.getAlbinoTypes(parent2);

        // 一方の親が2つ以上のアルビノを持っていないかチェック
        if (p1Albinos.length > 1) {
            return { error: `親1が複数のアルビノ系統を持っています: ${p1Albinos.join(', ')}。レオパは1つのアルビノ系統しか持てません。` };
        }
        if (p2Albinos.length > 1) {
            return { error: `親2が複数のアルビノ系統を持っています: ${p2Albinos.join(', ')}。レオパは1つのアルビノ系統しか持てません。` };
        }

        return { error: null };
    }

    /**
     * 保有するアルビノ系統を取得
     */
    getAlbinoTypes(parent) {
        const albinos = [];
        for (const [morphId, status] of Object.entries(parent)) {
            if (status === 'wild') continue;
            const morphInfo = this.morphDB[morphId];
            if (morphInfo?.albinoGroup) {
                albinos.push(morphInfo.name);
            }
        }
        return albinos;
    }
}
