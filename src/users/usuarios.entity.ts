import { Entity, PrimaryColumn, Column, OneToMany, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Enderecos } from '../enderecos/enderecos.entity';

export interface UserProfile {
    id: string;
    nome: string;
    email: string;
    tipo: 'CLIENTE' | 'FUNCIONARIO' | 'ADMIN';
    telefone?: string;
    data_nascimento?: string | Date;
}

@Entity('usuarios')
export class Usuarios implements UserProfile {
    @PrimaryColumn({ type: 'uuid' }) 
    id: string; 

    @Column()
    nome: string;

    @Column({ unique: true })
    email: string;

    @Column({ type: 'enum', enum: ['CLIENTE', 'FUNCIONARIO', 'ADMIN'] })
    tipo: 'CLIENTE' | 'FUNCIONARIO' | 'ADMIN';

    @Column({ nullable: true })
    telefone: string;

    @Column({ name: 'data_nascimento', type: 'date', nullable: true })
    data_nascimento: Date;

    @Column({ nullable: true })
    cpf: string;

    @OneToMany(() => Enderecos, (endereco) => endereco.usuario, { cascade: true })
    enderecos: Enderecos[];
}