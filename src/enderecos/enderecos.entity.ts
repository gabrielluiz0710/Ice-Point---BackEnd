import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Usuarios } from '../users/usuarios.entity';

@Entity('enderecos')
export class Enderecos {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column()
    logradouro: string;

    @Column()
    numero: string;

    @Column({ nullable: true })
    complemento: string;

    @Column()
    bairro: string;

    @Column()
    cidade: string;
    
    @Column()
    estado: string;

    @Column()
    cep: string;

    @Column({ default: false })
    principal: boolean;

    @Column({ name: 'usuario_id', type: 'uuid' })
    usuarioId: string;

    @ManyToOne(() => Usuarios, (usuario) => usuario.enderecos)
    @JoinColumn({ name: 'usuario_id' })
    usuario: Usuarios;
}